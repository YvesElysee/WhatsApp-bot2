const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

module.exports = {
    name: 'stt',
    category: 'ai',
    desc: 'Retranscrit un message vocal en texte.',
    run: async (sock, m, args, { reply }) => {
        const quoted = m.quoted ? m.quoted : m
        const mime = (quoted.msg || quoted).mimetype || ''

        if (!/audio/.test(mime)) return reply('❌ Répondez à un message vocal pour le transcrire !')

        reply('🎙️ Transcription en cours...')

        try {
            const stream = await downloadContentFromMessage(quoted.msg || quoted, 'audio')
            let buffer = Buffer.from([])
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }

            const prompt = "Transcris cet audio en texte français. Ne renvoie que le texte."

            // Shared key logic with index.js for consistency
            const clean = (k) => (typeof k === 'string') ? k.trim() : ''
            const keys = [
                clean(process.env.GEMINI_KEY_1),
                clean(process.env.GEMINI_KEY_2),
                clean(process.env.GEMINI_KEY_3),
                clean(process.env.GEMINI_KEY_4)
            ].filter(k => k.length > 10 && k.startsWith('AIza'))

            const key = keys[global.db.geminiIndex % keys.length]
            if (!key) throw new Error('Aucune clé Gemini valide pour la transcription')

            const axios = require('axios')
            const result = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "audio/ogg; codecs=opus", data: buffer.toString('base64') } }
                    ]
                }]
            })

            const text = result.data.candidates?.[0]?.content?.parts?.[0]?.text
            if (!text) throw new Error('Transcription vide')

            reply(`📝 *TRANSCRIPTION* :\n\n${text.trim()}`)
        } catch (e) {
            console.error(e)
            reply('❌ Échec de la transcription.')
        }
    }
}
