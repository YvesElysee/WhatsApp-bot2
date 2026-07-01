const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '.env') })

// ─────────────────────────────────────────────────────────
// OWNER DYNAMIQUE
// Si OWNER_NUMBER est défini dans .env, on l'utilise.
// Sinon, au démarrage du bot, index.js le remplace avec
// le numéro réel de la session WhatsApp connectée.
// ─────────────────────────────────────────────────────────
const ownerFromEnv = process.env.OWNER_NUMBER ? [process.env.OWNER_NUMBER.trim()] : null
global.owner = ownerFromEnv || [''] // Sera mis à jour dynamiquement dans index.js
global.authorNum = null              // JID complet, rempli quand la session est ouverte
global.mods = []
global.prems = []
global.packname = 'Ely Bot'
global.author = 'Elysée'

module.exports = {
    SESSION_ID: process.env.SESSION_ID || 'session',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || process.env.API_KEY || ''
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(`Update ${__filename}`)
    delete require.cache[file]
    require(file)
})
