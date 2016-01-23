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
var TEMPLATE = "Compteur d'éditions automatique";

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
client.getPagesTranscluding("Modèle:"+TEMPLATE, function (err, data) {
	if (err) {
		console.error(err);
		return;
	}

	login(function(err) {
		if (err) {
			console.error(err);
			return;
		}

		data.forEach(function (page) {
			handlePage(page.title);
		});
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
				var frequencyValidity = isFrequencyValid(template);
				if (frequencyValidity > 0) {
					var user = getUser(template, title);
					if (user === null) {
						endThisEach(null);
						return;
					}

					getEditCountForUser(user, function (err, editcount) {
						if (newEditcountIsDifferent(template, editcount))
							newcontent = getNewPageContent(newcontent, template, frequencyValidity, editcount);

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
 * @returns {number} - 0: false, 1: true, 2: true but need to add frequency
 */
function isFrequencyValid(template) {
	var now = new Date(),
		match = template.match(/\|(fréquence|frequency)=(journalière|hebdomadaire|bimensuelle|mensuelle|daily|weekly|bimonthly|monthly)/i);

	// When parameter is not valid or present
	if (match === null)
		return 2;

	// Check if it is time to update
	if (now.getHours() === 0) {
		switch (match[2]) {
			case "journalière" :
			case "daily" :
				return 1;
			case "hebdomadaire" :
			case "weekly" :
				if (now.getDay() == 1) // Monday
					return 1;
				break;
			case "bimensuelle" :
			case "bimonthly" :
				if (now.getDate() == 1 || now.getDate() == 15) // 1st and 15th of the month
					return 1;
				break;
			case "mensuelle" :
			case "monthly" :
				if (now.getDate() == 1) // 1st of the month
					return 1;
				break;
		}
	}

	return 0;
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
 * @param {number} frequency - the state of the frequency (0, 1 or 2)
 * @param {number} editcount - the actual editcount
 * @return {string}
 */
function getNewPageContent(oldcontent, template, frequency, editcount) {
	if(frequency == 2) // If frequency needs to be added
		template= template.replace('}}', 'fréquence=hebdomadaire');

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
 * Log the bot in
 * @param callback
 */
function login(callback) {
	async.retry({times: 5, interval: 5000}, function (retryCallback) {
		client.logIn(function (err) {
			if (err) {
				retryCallback(err);
				return;
			}

			retryCallback(null);
		});
	}, function (err) {
		if (err) {
			callback(err);
			return;
		}
		callback(null);
	});
}
/**
 * Update the template on a page
 * @param {string} page - the page to edit
 * @param {string} newcontent - the new content
 */
function updatePage(page, newcontent) {
	async.retry({times: 3, interval: 1000}, function (callback) {
		client.edit(page, newcontent, "Mise à jour [[User:Compteur d'éditions (bot)|automatique]] du compteur d'éditions", function (err) {
			if (err) {
				callback(err);
				return;
			}

			callback(null);
		});
	}, function (err) {
		if (err) {
			console.error(err+" - "+page);
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
