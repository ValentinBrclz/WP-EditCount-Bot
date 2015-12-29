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
/// Vars
var path = require('path'),
	bot = require('nodemw'),
	client = new bot(path.normalize(__dirname+'/config.json')),
	async = require('async'),
	_ = require('lodash'),
	escapeStringRegexp = require('escape-string-regexp'),
	CATEGORY = "Compteur d'édition automatique",
	TEMPLATE = "Utilisateur:Compteur d'édition (bot)/Modèle";

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
/// FUNCTIONS
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
				var user = getUser(template, title);
				if (user === null)
					return;

				getEditCountForUser(user, function (err, editcount) {
					if (newEditcountIsDifferent(template, editcount))
						newcontent = getNewPageContent(newcontent, template, editcount);

					endThisEach(null);
				});
			}, function (err) {
				if (err) {
					console.error(err);
					return;
				}

				async.retry(3, function(callback) {
					updatePage(title, newcontent, function (err) {
						if (err)
							callback(err);
						else
							callback(null, true);
					});
				}, function(err) {
					if(err) {
						console.error(err);
					}
				});
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
	var match = template.match(/\|user=([^|}]+)/i),
		user;

	if (match === null && page.startsWith("Utilisat"))
		user = page.replace(/^utilisat(eur|rice):([^\/]+)(\/.+)?/i,"$2");
	else
		user = match[1];

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
 * @param callback
 */
function updatePage(page, newcontent, callback) {
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
