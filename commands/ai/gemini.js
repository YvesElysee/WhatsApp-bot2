const axios = require('axios')

module.exports = {
    name: 'gemini',
    category: 'ai',
    desc: 'Version alternative de Gemini.',
    run: async (sock, m, args, { reply, text, getGeminiResponse }) => {
        if (!text) return reply('🤖 Posez-moi une question !')

        try {
            const geminiReply = await getGeminiResponse(text)
            if (!geminiReply) return reply('❌ Pas de réponse.')
            reply(`✨ *IA Gemini*:\n\n${geminiReply}`)
        } catch (e) {
            console.error(e)
            reply('❌ Erreur Gemini. Vérifiez votre configuration.')
        }
    }
}
