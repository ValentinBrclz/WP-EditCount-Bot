/*
 * WP-EditCount-Bot
 *
 * Wikipedia bot that updates the current editcount of users in a lua module
 * Copyright (C) 2015-2016 Valentin Berclaz
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

// CONSTANTS
var TEMPLATE = 'Compteur d\'éditions automatique',
	DATAPAGE = 'Module:Compteur d\'éditions automatique/data';

// REQUIREMENTS
var path = require('path'),
	bot = require('nodemw'),
	client = new bot(path.normalize(__dirname + '/config.json')),// jscs:ignore requireCapitalizedConstructors
	async = require('async'),
	escapeStringRegexp = require('escape-string-regexp');

// GLOBAL VARS
var USERS = [];

// MAIN
client.getPagesTranscluding('Modèle:' + TEMPLATE, function(err, data) {
	if (err)
		return console.error(err);

	login(function(err) {
		if (err)
			return console.error(err);

		// Make the list of users
		async.each(
			data, // Table
			function(page, endThisEach) {
				// Each time
				getUsersFromPage(page.title, function(err, data) {
					if (err)
						console.error(err);
					USERS = USERS.addWithoutDuplicate(data);
					endThisEach();
				});
			},
			function(err) {
				// Finally
				if (err)
					console.error(err);

				getEditCountForUsers(USERS, function(err, data) {
					updateLuadata(data);
				});
			}
		);
	});
});

// GET FUNCTIONS
/**
 * Get all the users of the editcount templates on a page
 * @param {string} title - The page to handle
 * @param callback
 */
function getUsersFromPage(title, callback) {
	var users = [];
	getTemplatesOnPage(title, function(err, templates) {
		if (err)
			return callback(err);


		// Get user for each template on the page
		async.each(templates, function(template, callback) {
			var user = getUser(template, title);
			if (user)
				users.push(user);
			callback();
		}, function(err) {
			if (err)
				return callback(err);

			callback(null, users);
		});
	});
}

/**
 * Get all editcount templates of a specific page in an array
 * @param {string} page - the page to scan
 * @param callback
 */
function getTemplatesOnPage(page, callback) {
	client.getArticle(page, function(err, content) {
		if (err)
			return callback(err);

		var templateRegex = new RegExp('{{' + escapeStringRegexp(TEMPLATE) + '(\\|.+)*}}', 'ig');

		callback(null, content.match(templateRegex));
	});
}

/**
 * Returns the user
 * @param {string} template - The template to analyse
 * @param {string} page - The page analyzed
 * @return {string}
 */
function getUser(template, page) {
	var cleanedTemplate = template.replace(/\|(raw|brut)=[^|}]+/i, ''),
		regex = new RegExp('^{{' + escapeStringRegexp(TEMPLATE) + '\\|([^=|}]+)', 'i'),
		match = cleanedTemplate.match(regex),
		user;

	if (match === null) {
		if (/^(discussion )?u(tilisat(eur|rice)|ser)( talk)?:/i.test(page))
			user = page.replace(/^(discussion )?u(tilisat(eur|rice)|ser)( talk)?:([^\/]+)(\/.+)?/i, '$5');
		else {
			user = null;
			console.error('No match and not detected as an user page', template, page);
		}
	} else
		user = match[1];

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

	client.getAll(params, 'users', function(err, info) {
		if (err)
			return callback(err);

		callback(null, info);
	});
}

/**
 * Transform raw data from the API to Lua-Data object
 * @param {Array} rawdata - the raw data from the API
 * @return {string}
 */
function getLuadataFromArray(rawdata) {
	var lua = 'return {';

	rawdata.forEach(function(object) {
		lua = lua + '\n\t[\"' + object.name + '\"] = ' + object.editcount + ',';
	});

	lua = lua + '\n}';

	return lua;
}

// ACTION FUNCTIONS
/**
 * Log the bot in
 * @param callback
 */
function login(callback) {
	async.retry({times: 5, interval: 5000}, function(callback) {
		client.logIn(function(err) {
			if (err) {
				callback(err);
				return;
			}

			callback();
		});
	}, function(err) {
		if (err)
			return callback(err);

		callback();
	});
}

/**
 * Update the lua data module
 * @param {Array} rawdata - an array containing the result of the editcount request
 */
function updateLuadata(rawdata) {
	var newcontent = getLuadataFromArray(rawdata);

	async.retry({times: 5, interval: 1000}, function(callback) {
		client.edit(DATAPAGE, newcontent, 'Mise à jour [[User:Compteur d\'éditions (bot)|automatique]] des données', function(err) {
			if (err)
				return callback(err);

			callback();
		});
	}, function(err) {
		if (err)
			return console.error(err);
	});
}

// PROTOTYPE AND OVERRIDING FUNCTIONS
/**
 * Add elements from an array to another only if they are not duplicating
 * @param {Array} data - the array containing the elements to add
 * @returns {Array}
 */
Array.prototype.addWithoutDuplicate = function(data) {
	var main = this;

	data.forEach(function(value) {
		if (value === null) return;
		if (main.indexOf(value) === -1) main.push(value);
	});

	return main;
};
