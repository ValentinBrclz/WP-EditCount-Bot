WP-EditCount-Bot
========================
[![Build Status](https://api.travis-ci.org/ValentinBrclz/WP-EditCount-Bot.png)](http://travis-ci.org/ValentinBrclz/WP-EditCount-Bot)
[![Dependency Status](https://img.shields.io/david/ValentinBrclz/WP-EditCount-Bot.svg?style=flat)](https://david-dm.org/ValentinBrclz/WP-EditCount-Bot#info=Dependencies)
[![devDependency Status](https://img.shields.io/david/dev/ValentinBrclz/WP-EditCount-Bot.svg?style=flat)](https://david-dm.org/ValentinBrclz/WP-EditCount-Bot#info=devDependencies)
[![License](https://img.shields.io/badge/license-GPLv2-blue.svg?style=flat)](http://opensource.org/licenses/GPL-2.0)

_**(en)**_ Wikipedia FR Bot that update the current edit count of users where it is requested

_**(fr)**_ Robot de la Wikipédia francophone qui met à jour les compteurs d'édition là cela est demandé

## Fonctionnement
1. Rechercher toutes les occurrences du modèle *{{Compteur d'édition automatique}}*
2. Modifier le premier paramètre avec le nombre d'édition de l'utilisateur

## Paramètres du modèle
* user / utilisateur : L'utilisateur dont il faut retourner le nombre d'éditions. Défaut: utilisateur de la page courante
* frequency ou fréquence : La fréquence d'actualisation. Défaut: à chaque lancement du script

## Voir le robot
Le robot fonctionne sur Wikipédia sous le nom [Compteur d'édition (bot)](https://fr.wikipedia.org/wiki/Utilisateur:Compteur d'édition (bot))

## License and credits
* License: GNU General Public Licence (2.0)
* Author: [Valentin Berclaz](http://www.valentinbeclaz.com/) ([GitHub Profile](https://github.com/ValentinBrclz))
