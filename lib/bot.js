/*
 * WP-EditCount-Bot
 *
 * Wikipedia FR Bot that signs when users forget to do so
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
var bot = require('nodemw'),
	client = new bot('lib/config.json'),
	async = require('async'),
	CATEGORY = "Utilisateur avec contrôle de signature"; // Catégorie:Wikipédia:Compteur d'édition automatique

/////////////////////////
/// MAIN
client.getPagesInCategory(CATEGORY, function(err, data) {
	data.forEach(function(page) {
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

}

/////////////////////////
/// GET FUNCTIONS


/////////////////////////
/// ACTION FUNCTIONS


/////////////////////////
/// TEST FUNCTIONS (boolean return)


////////////////////////////////
/// PROTOTYPE AND OVERRIDING FUNCTIONS
