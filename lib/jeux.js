/**
 * Helpers partagés des jeux Ely-Bot.
 *
 * - Niveaux de difficulté par chat (`.niveau facile/moyen/difficile`)
 *   qui pilotent le nombre d'essais et la difficulté des questions.
 * - Mécanique « on continue ? » en fin de manche : après la victoire
 *   ou la révélation de la réponse, le bot propose une nouvelle manche.
 */

const NIVEAUX = ['facile', 'moyen', 'difficile']

/** Niveau actif du chat (défaut : moyen). */
const difficulteDe = (chatId) => {
    const n = global.db.difficulte?.[chatId]
    return NIVEAUX.includes(n) ? n : 'moyen'
}

/**
 * Nombre d'essais pour le niveau courant.
 * @param {string} chatId
 * @param {{facile:number, moyen:number, difficile:number}} table
 */
const essaisPour = (chatId, table) => {
    const n = difficulteDe(chatId)
    return typeof table[n] === 'number' ? table[n] : table.moyen
}

/**
 * En fin de manche : envoie le bilan + demande « on continue ? » puis
 * installe un listener éphémère qui relance une manche sur réponse
 * positive (oui/non/ignoré silencieusement).
 *
 * @param {string} from chat du jeu
 * @param {Function} reply fonction de réponse du contexte courant
 * @param {string} texte bilan de fin de manche (victoire/défaite)
 * @param {Function} relancer () => nouvelle manche (même niveau)
 * @param {object} options options de sendMessage (mentions…)
 */
const demanderSuite = async (from, reply, texte, relancer, options = {}) => {
    await reply(
        texte +
        '\n\n🔄 *On continue ?* Répondez _oui_ pour une nouvelle manche, _non_ pour terminer.',
        options
    )
    global.db.games[from] = {
        type: 'suite',
        listener: async (sock2, m2, { body, reply: r }) => {
            const rep = String(body || '')
                .trim().toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            if (/^(oui|ok|go|rejouer|yes|continue|encore|partie)/.test(rep)) {
                delete global.db.games[from]
                try { await relancer() } catch (e) {
                    console.error('[JEU] Relance :', e.message)
                    await r('❌ Nouvelle manche impossible pour le moment.')
                }
            } else if (/^(non|non merci|stop|arret|abandon|quitter|basta)/.test(rep)) {
                delete global.db.games[from]
                await r('👋 À bientôt pour une nouvelle partie !')
            }
            // autre message : on ignore silencieusement
        }
    }
}

/** Vrai si une vraie partie (hors phase « on continue ? ») bloque le chat. */
const partieEnCours = (from) => {
    const p = global.db.games?.[from]
    return p && p.type !== 'suite' ? p : null
}

module.exports = { NIVEAUX, difficulteDe, essaisPour, demanderSuite, partieEnCours }
