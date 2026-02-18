const axios = require('axios')

module.exports = {
    name: 'capture',
    category: 'tools',
    desc: 'Prend une capture d\'écran d\'un site web.',
    commands: ['capture', 'ss', 'screenshot'],
    run: async (sock, m, args, { reply, text }) => {
        if (!text) return reply('❌ Veuillez fournir l\'URL du site à capturer. Exemple: `.capture https://google.com`')

        let url = text.trim()
        if (!url.startsWith('http')) url = 'https://' + url

        reply(`📸 Capture d'écran en cours pour : *${url}*...`)

        try {
            // Service gratuit mShot de WordPress (pas de clé requise)
            const screenshotUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=1024`

            await sock.sendMessage(m.key.remoteJid, {
                image: { url: screenshotUrl },
                caption: `✅ Voici la capture d'écran de : *${url}*`
            }, { quoted: m })

        } catch (e) {
            console.error('[CAPTURE ERROR]', e)
            reply('❌ Erreur lors de la capture d\'écran. Vérifiez l\'URL ou réessayez plus tard.')
        }
    }
}
