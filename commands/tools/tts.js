const googleTTS = require('google-tts-api')
const fs = require('fs')
const path = require('path')
const https = require('https')

module.exports = {
    name: 'tts',
    run: async (sock, m, args, { reply, text }) => {
        if (!text) return reply('Usage: .tts [votre texte]')

        reply('🔊 Conversion en audio...')
        const filePath = path.join(__dirname, '../../temp', `${Date.now()}.mp3`)

        try {
            const url = googleTTS.getAudioUrl(text, {
                lang: 'fr',
                slow: false,
                host: 'https://translate.google.com'
            })

            // Download the audio file
            const file = fs.createWriteStream(filePath)
            await new Promise((resolve, reject) => {
                https.get(url, (response) => {
                    response.pipe(file)
                    file.on('finish', () => { file.close(); resolve() })
                }).on('error', (err) => {
                    fs.unlink(filePath, () => { })
                    reject(err)
                })
            })

            await sock.sendMessage(m.key.remoteJid, {
                audio: { url: filePath },
                mimetype: 'audio/mp4',
                ptt: true
            }, { quoted: m })

            // Cleanup
            setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) }, 5000)
        } catch (e) {
            console.error(e)
            reply('❌ Erreur lors de la génération de l\'audio.')
        }
    }
}
