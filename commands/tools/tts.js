const gtts = require('node-gtts')
const fs = require('fs')
const path = require('path')

module.exports = {
    name: 'tts',
    run: async (sock, m, args, { reply, text }) => {
        if (!text) return reply('Usage: .tts [votre texte]')

        reply('🔊 Conversion en audio...')
        const lang = 'fr' // Default to French
        const filePath = path.join(__dirname, '../../temp', `${Date.now()}.mp3`)

        try {
            const speech = gtts(lang)
            speech.save(filePath, text, () => {
                sock.sendMessage(m.key.remoteJid, {
                    audio: { url: filePath },
                    mimetype: 'audio/mp4',
                    ptt: true // Send as a voice note
                }, { quoted: m })

                // Cleanup
                setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) }, 5000)
            })
        } catch (e) {
            console.error(e)
            reply('❌ Erreur lors de la génération de l\'audio.')
        }
    }
}
