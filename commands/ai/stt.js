const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

module.exports = {
    name: 'stt',
    run: async (sock, m, args, { reply, getGeminiClient }) => {
        const quoted = m.quoted ? m.quoted : m
        const mime = (quoted.msg || quoted).mimetype || ''

        if (!/audio/.test(mime)) return reply('❌ Répondez à un message vocal pour le transcrire !')

        const client = getGeminiClient()
        if (!client) return reply('⚠️ Clé Gemini manquante.')

        reply('🎙️ Transcription en cours (New SDK)...')

        try {
            const stream = await downloadContentFromMessage(quoted.msg || quoted, 'audio')
            let buffer = Buffer.from([])
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]) }

            const result = await client.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: [
                    { text: "Transcris cet audio en texte français. Ne renvoie que le texte." },
                    {
                        inlineData: {
                            mimeType: "audio/ogg; codecs=opus",
                            data: buffer.toString('base64')
                        }
                    }
                ]
            })

            if (!result.text) throw new Error('Transcription vide')

            reply(`📝 *TRANSCRIPTION* :\n\n${result.text.trim()}`)
        } catch (e) {
            console.error(e)
            reply('❌ Échec de la transcription via New SDK.')
        }
    }
}
