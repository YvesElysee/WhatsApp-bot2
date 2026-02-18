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
            // Utilisation d'une API de capture gratuite et stable (screenshotlayer ou similaire)
            // Ici on utilise un service public de rendu d'image de site web
            const screenshotUrl = `https://api.screenshotmachine.com?key=740880&url=${encodeURIComponent(url)}&dimension=1024x768`

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
