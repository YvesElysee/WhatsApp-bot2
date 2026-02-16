const axios = require('axios')
const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

module.exports = {
    name: 'stt',
    run: async (sock, m, args, { reply }) => {
        const quoted = m.quoted ? m.quoted : m
        const mime = (quoted.msg || quoted).mimetype || ''

        if (!/audio/.test(mime)) return reply('❌ Répondez à un message vocal pour le transcrire !')

        const geminiKey = process.env.GEMINI_API_KEY
        if (!geminiKey) return reply('⚠️ Clé Gemini manquante. La transcription utilise Gemini.')

        reply('🎙️ Transcription en cours (IA)...')

        try {
            const stream = await downloadContentFromMessage(quoted.msg || quoted, 'audio')
            let buffer = Buffer.from([])
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }

            const base64Audio = buffer.toString('base64')

            // Using Gemini to transcribe (Gemini 1.5 Pro/Flash supports audio)
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
                contents: [{
                    parts: [
                        { text: "Transcris cet audio en texte français. Ne renvoie que le texte." },
                        { inline_data: { mime_type: "audio/ogg", data: base64Audio } }
                    ]
                }]
            })

            const transcription = response.data.choices?.[0]?.message?.content || response.data.candidates?.[0]?.content?.parts?.[0]?.text
            if (!transcription) throw new Error('Transcription vide')

            reply(`📝 *TRANSCRIPTION* :\n\n${transcription.trim()}`)
        } catch (e) {
            console.error(e)
            reply('❌ Échec de la transcription. Assurez-vous d\'avoir une clé Gemini valide et active.')
        }
    }
}
