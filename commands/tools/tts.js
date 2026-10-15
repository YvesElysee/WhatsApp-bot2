const googleTTS = require('google-tts-api')
const axios = require('axios')

module.exports = {
    name: 'tts',
    category: 'tools',
    desc: 'Convertit un texte en message vocal (français).',
    run: async (sock, m, args, { reply, text }) => {
        if (!text) return reply('Usage: `.tts [votre texte]`')

        await reply('🔊 Conversion en audio...')

        try {
            // google-tts-api limite à 200 caractères par requête
            const url = googleTTS.getAudioUrl(text.slice(0, 190), {
                lang: 'fr',
                slow: false,
                host: 'https://translate.google.com'
            })

            const reponse = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            })
            const buffer = Buffer.from(reponse.data)

            await sock.sendMessage(m.key.remoteJid, {
                audio: buffer,
                mimetype: 'audio/mp4',
                ptt: true
            }, { quoted: m })
        } catch (e) {
            console.error('[TTS]', e.message)
            reply('❌ Erreur lors de la génération de l\'audio.')
        }
    }
}
