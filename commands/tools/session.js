const fs = require('fs')
const path = require('path')

// Dossier de session — doit correspondre à celui utilisé par index.js
const dossierSession = () => (process.env.VERCEL ? '/tmp/session' : path.join(__dirname, '..', '..', 'session'))

module.exports = {
    name: 'session',
    category: 'tools',
    desc: 'Exporte la session WhatsApp en Base64 (SESSION_DATA).',
    commands: ['session', 'sessionid'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Commande réservée au propriétaire du bot.')

        const chemin = path.join(dossierSession(), 'creds.json')
        if (!fs.existsSync(chemin)) {
            return reply('❌ Fichier de session introuvable. Connectez d\'abord le bot.')
        }

        const creds = fs.readFileSync(chemin, 'utf-8')
        const base64 = Buffer.from(creds).toString('base64')
        const autoSync = !!(process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID)

        reply(
            `🤫 *SESSION ID — NE PAS PARTAGER*\n\n` +
            `Copiez ce texte et ajoutez-le comme variable d'environnement sur Render/Vercel avec le nom *SESSION_DATA* :\n\n` +
            '```' + base64 + '```\n\n' +
            `ℹ️ *Persistance :* ${autoSync ? '✅ Auto-sync Render active.' : '❌ Auto-sync inactive (RENDER_API_KEY manquante).'}`
        )
    }
}
