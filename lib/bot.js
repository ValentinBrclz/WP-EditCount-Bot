/*
 * WP-EditCount-Bot
 *
 * Wikipedia FR Bot that update the current edit count of users
 * where it is requested
 * Copyright (C) 2015 Valentin Berclaz
 * <http://www.valentinberclaz.com/>
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; version 2 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */
'use strict';

/////////////////////////
/// CONSTANTS
var CATEGORY = "Wikipédia:Compteur d'édition automatique",
	TEMPLATE = "Compteur d'édition automatique";

/////////////////////////
/// REQUIREMENTS
var path = require('path'),
	bot = require('nodemw'),
	client = new bot(path.normalize(__dirname + '/config.json')),
	async = require('async'),
	_ = require('lodash'),
	escapeStringRegexp = require('escape-string-regexp');

/////////////////////////
/// MAIN
client.getPagesInCategory(CATEGORY, function (err, data) {
	if (err) {
		console.error(err);
		return;
	}

	data.forEach(function (page) {
		handlePage(page.title);
	});
});

/////////////////////////
/// PROCESS HANDLING FUNCTIONS
/**
 * Handle the actions to do on a specific page
 * @param {string} title - The page to handle
 */
function handlePage(title) {
	getTemplatesOnPage(title, function (err, templates) {
		if (err) {
			console.error(err);
			return;
		}

		client.getArticle(title, function (err, content) {
			var newcontent = content;

			async.each(templates, function (template, endThisEach) {
				if (isFrequencyValid(template)) {
					var user = getUser(template, title);
					if (user === null) {
						endThisEach(null);
						return;
					}

					getEditCountForUser(user, function (err, editcount) {
						if (newEditcountIsDifferent(template, editcount))
							newcontent = getNewPageContent(newcontent, template, editcount);

						endThisEach(null);
					});
				}
				else
					endThisEach(null);
			}, function (err) {
				if (err) {
					console.error(err);
					return;
				}

				updatePage(title, newcontent);
			});
		});
	});
}

/////////////////////////
/// TEST FUNCTIONS
/**
 * Test if editcount is different that the one in the template
 * @param {string} template
 * @param {number} editcount
 * @returns {boolean}
 */
function newEditcountIsDifferent(template, editcount) {
	var regex = new RegExp("^{{" + escapeStringRegexp(TEMPLATE) + "\\|([0-9]+)"),
		match = template.match(regex);

	if (match === null)
		return true;

	return (match[1] != editcount);
}

/**
 * Check if it is time to update the template
 * @param {string} template - the template to check
 * @returns {boolean}
 */
function isFrequencyValid(template) {
	var now = new Date(),
		match = template.match(/\|(fréquence|frequency)=(journalière|hebdomadaire|bimensuelle|mensuelle|daily|weekly|bimonthly|monthly)/i);

	// When parameter is not valid or present
	if (match === null)
		return true;

	// Check if it is time to update
	if (now.getHours() === 0) {
		switch (match[2]) {
			case "journalière" :
			case "daily" :
				return true;
			case "hebdomadaire" :
			case "weekly" :
				if (now.getDay() == 1) // Monday
					return true;
				break;
			case "bimensuelle" :
			case "bimonthly" :
				if (now.getDate() == 1 || now.getDate() == 15) // 1st and 15th of the month
					return true;
				break;
			case "mensuelle" :
			case "monthly" :
				if (now.getDate() == 1) // 1st of the month
					return true;
				break;
		}
	}

	return false;
}

/////////////////////////
/// GET FUNCTIONS
/**
 * Get all edit count templates of a specific page in an array
 * @param {string} page - the page to scan
 * @param callback
 */
function getTemplatesOnPage(page, callback) {
	client.getArticle(page, function (err, content) {
		if (err) {
			callback(err);
			return;
		}

		var template_regex = new RegExp("{{" + escapeStringRegexp(TEMPLATE) + "(\\|.+)*}}", "g");

		callback(null, content.match(template_regex));
	});
}

/**
 * Returns the user
 * @param {string} template - The template to analyse
 * @param {string} page - The page analyzed
 * @return {string}
 */
function getUser(template, page) {
	var match = template.match(/\|u(tilisat(eur|rice)|ser)=([^|}]+)/i),
		user;

	if (match === null && (page.startsWith("Utilisat") || page.startsWith("User:")))
		user = page.replace(/^U(tilisat(eur|rice)|ser):([^\/]+)(\/.+)?/, "$3");
	else
		user = match[3];

	return user;
}

/**
 * Get the editcount for a specific user
 * @param {string} username
 * @param callback
 */
function getEditCountForUser(username, callback) {
	var params = {
		action: 'query',
		list: 'users',
		usprop: 'editcount',
		ususers: username
	};

	client.api.call(params, function (err, info) {
		if (_.has(info, 'users[0].editcount')) {
			callback(null, info.users[0].editcount);
		}
		else
			callback(new Error("User or IP does not exist.")); // Invalid user
	});
}

/**
 * Update the template in the content
 * @param {string} oldcontent - the old content of the page
 * @param {string} template - the detected template
 * @param {number} editcount - the actual editcount
 * @return {string}
 */
function getNewPageContent(oldcontent, template, editcount) {
	return oldcontent.replace(template, getUpdatedTemplate(template, editcount));
}

/**
 * Gives the template updated with editcount
 * @param {string} template
 * @param {number} editcount
 * @return {string}
 */
function getUpdatedTemplate(template, editcount) {
	var edit_regex = new RegExp("^{{" + escapeStringRegexp(TEMPLATE) + "(\\|[0-9]+)?");

	return template.replace(edit_regex, "{{" + TEMPLATE + "|" + editcount);
}

/////////////////////////
/// ACTION FUNCTIONS
/**
 * Update the template on a page
 * @param {string} page - the page to edit
 * @param {string} newcontent - the new content
 */
function updatePage(page, newcontent) {
	async.retry({times: 3, interval: 5000}, function (callback) {
		client.logIn(function (err) {
			if (err) {
				callback(err);
				return;
			}

			client.edit(page, newcontent, "Mise à jour [[User:Compteur d'édition (bot)|automatique]] du compteur d'édition", function (err) {
				if (err) {
					callback(err);
					return;
				}

				callback(null);
			});
		});
	}, function (err) {
		if (err) {
			console.error(err);
		}
	});
}

////////////////////////////////
/// PROTOTYPE AND OVERRIDING FUNCTIONS
/**
 * Search for 'search' at the beginning of the String
 * @param {string} search - the string to search for
 * @return {boolean}
 */
String.prototype.startsWith = function (search) {
	return this.indexOf(search) === 0;
};
