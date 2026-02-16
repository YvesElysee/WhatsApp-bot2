const axios = require('axios')

module.exports = {
    name: 'devine',
    run: async (sock, m, args, { reply }) => {
        const geminiKey = process.env.GEMINI_API_KEY
        if (!geminiKey) return reply('⚠️ Gemini non configuré.')

        try {
            reply('⏳ Recherche d\'une devinette...')
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
                contents: [{ parts: [{ text: "Génère une devinette courte en français. Donne la réponse à la fin cachée par ||." }] }]
            })
            reply(`🧩 *DEVINETTE*:\n\n${response.data.candidates[0].content.parts[0].text}`)
        } catch (e) {
            reply('❌ Erreur devinette.')
        }
    }
}
