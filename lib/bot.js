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
var TEMPLATE = "Compteur d'éditions automatique",
	DATAPAGE = "Module:Compteur d'éditions automatique/data";

/////////////////////////
/// REQUIREMENTS
var path = require('path'),
	bot = require('nodemw'),
	client = new bot(path.normalize(__dirname + '/config.json')),
	async = require('async'),
	_ = require('lodash'),
	escapeStringRegexp = require('escape-string-regexp');

/////////////////////////
/// GLOBAL VARS
var g_users = [];

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

		// Make the list of users
		async.each(
			data, // Table
			function (page, endThisEach) {
				// each time
				getUsersFromPage(page.title, function (err, data) {
					if (err)
						console.error(err);
					g_users = g_users.addWithoutDuplicate(data);
					endThisEach();
				});
			},
			function (err) {
				// Finally
				if (err)
					console.error(err);

				getEditCountForUsers(g_users, function (err, data) {
					updateLuadata(data);
				});
			});
	});
});

/////////////////////////
/// GET FUNCTIONS
/**
 * Get all the users of the editcount templates on a page
 * @param {string} title - The page to handle
 * @param callback
 */
function getUsersFromPage(title, callback) {
	var l_users = [];
	getTemplatesOnPage(title, function (err, templates) {
		if (err) {
			callback(err, null);
			return;
		}

		// Get user for each template on the page
		async.each(templates, function (template, endThisEach) {
			var user = getUser(template, title);
			if (user === null)
				endThisEach(null);
			else {
				l_users.push(user);
				endThisEach(null);
			}
		}, function (err) {
			if (err) {
				callback(err, null);
				return;
			}

			callback(null, l_users);
		});
	});
}

/**
 * Get all editcount templates of a specific page in an array
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

	if (match === null) {
		if (page.startsWith("Utilisat") || page.startsWith("User:"))
			user = page.replace(/^U(tilisat(eur|rice)|ser):([^\/]+)(\/.+)?/, "$3");
		else {
			user = null;
			console.error("No match and not User/Utilisateur page", template, page); //FIXME
		}
	}
	else
		user = match[3];

	return user;
}

/**
 * Get the editcount for the specified users
 * @param {Array} usernames - an array containing the username to get the editcount of
 * @param callback
 */
function getEditCountForUsers(usernames, callback) {
	var params = {
		action: 'query',
		list: 'users',
		usprop: 'editcount',
		ususers: usernames.join('|')
	};

	client.getAll(params, 'users', function (err, info) {
		if (err) {
			callback(err, null);
			return;
		}

		callback(null, info);
	});
}

/**
 * Transform raw data from the API to Lua-Data object
 * @param {Array} rawdata - the raw data from the API
 * @return {string}
 */
function getLuadataFromArray(rawdata) {
	var lua = "return {";

	rawdata.forEach(function (object) {
		lua = lua + "\n\t[\"" + object.name + "\"] = " + object.editcount;
	});

	lua = lua + "\n}";

	return lua;
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
 * Update the lua data module
 * @param {Array} rawdata - an array containing the result of the editcount request
 *
 */
function updateLuadata(rawdata) {
	var newcontent = getLuadataFromArray(rawdata);

	async.retry({times: 5, interval: 1000}, function (callback) {
		client.edit(DATAPAGE, newcontent, "Mise à jour [[User:Compteur d'éditions (bot)|automatique]] du compteur d'éditions", function (err) {
			if (err) {
				callback(err);
				return;
			}

			callback(null);
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

/**
 * Add elements from an array to another only if they are not duplicating
 * @param {Array} data - the array containing the elements to add
 * @returns {Array}
 */
Array.prototype.addWithoutDuplicate = function (data) {
	var main = this;

	data.forEach(function (value) {
		if (value === null) return;
		if (main.indexOf(value) == -1) main.push(value);
	});

	return main;
};
