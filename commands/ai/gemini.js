const axios = require('axios')

module.exports = {
    name: 'gemini',
    run: async (sock, m, args, { reply, text }) => {
        if (!text) return reply('🤖 Posez-moi une question !')
        const geminiKey = process.env.GEMINI_API_KEY
        if (!geminiKey) return reply('⚠️ Clé GEMINI_API_KEY manquante sur Render.')

        try {
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
                contents: [{ parts: [{ text: text }] }]
            })
            const geminiReply = response.data.candidates[0].content.parts[0].text
            reply(`✨ *IA Gemini*:\n\n${geminiReply}`)
        } catch (e) {
            console.error(e)
            reply('❌ Erreur Gemini. Vérifiez votre clé.')
        }
    }
}
