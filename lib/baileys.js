/**
 * Adaptateur de compatibilité ESM → CommonJS pour Baileys
 *
 * Baileys v7+ est un module ES (ESM) pur, incompatible avec require().
 * Ce fichier utilise import() dynamique (supporté par tous les modules CJS
 * depuis Node.js 12) pour charger Baileys une seule fois, puis met le
 * résultat en cache pour toutes les utilisations suivantes.
 *
 * Usage dans le reste du code :
 *   const { getBaileys } = require('./lib/baileys')
 *   const { default: makeWASocket, getContentType, ... } = await getBaileys()
 */

let _moduleCache = null   // Résultat mis en cache après le premier chargement
let _chargementEnCours = null  // Promesse en cours pour éviter les chargements multiples simultanés

/**
 * Charge Baileys une seule fois et retourne ses exports.
 * Les appels suivants reçoivent directement le cache (synchrone).
 * @returns {Promise<object>} Exports du module Baileys
 */
const getBaileys = async () => {
    // Retourner le cache si déjà chargé
    if (_moduleCache) return _moduleCache

    // Si un chargement est déjà en cours, attendre sa fin
    if (_chargementEnCours) return _chargementEnCours

    // Premier chargement : utiliser import() dynamique (ESM compatible CJS)
    _chargementEnCours = import('@whiskeysockets/baileys').then(mod => {
        _moduleCache = mod
        _chargementEnCours = null
        console.log('[BAILEYS] Module chargé avec succès via import() dynamique.')
        return mod
    }).catch(err => {
        _chargementEnCours = null // Réinitialiser en cas d'erreur pour permettre une nouvelle tentative
        throw err
    })

    return _chargementEnCours
}

module.exports = { getBaileys }
