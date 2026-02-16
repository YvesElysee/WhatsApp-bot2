const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

module.exports = {
    name: 'stt',
    run: async (sock, m, args, { reply, getGeminiModel }) => {
        const quoted = m.quoted ? m.quoted : m
        const mime = (quoted.msg || quoted).mimetype || ''

        if (!/audio/.test(mime)) return reply('❌ Répondez à un message vocal pour le transcrire !')

        const model = getGeminiModel('gemini-1.5-flash')
        if (!model) return reply('⚠️ Clé Gemini manquante.')

        reply('🎙️ Transcription en cours (SDK AI)...')

        try {
            const stream = await downloadContentFromMessage(quoted.msg || quoted, 'audio')
            let buffer = Buffer.from([])
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }

            const result = await model.generateContent([
                "Transcris cet audio en texte français. Ne renvoie que le texte.",
                {
                    inlineData: {
                        mimeType: "audio/ogg; codecs=opus",
                        data: buffer.toString('base64')
                    }
                }
            ])
            const response = await result.response
            const transcription = response.text()

            if (!transcription) throw new Error('Transcription vide')

            reply(`📝 *TRANSCRIPTION* :\n\n${transcription.trim()}`)
        } catch (e) {
            console.error(e)
            reply('❌ Échec de la transcription via SDK.')
        }
    }
}
