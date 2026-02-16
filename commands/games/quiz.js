const axios = require('axios')

module.exports = {
    name: 'quiz',
    run: async (sock, m, args, { reply }) => {
        const geminiKey = process.env.GEMINI_API_KEY
        if (!geminiKey) return reply('⚠️ Gemini non configuré.')

        try {
            reply('🎲 Génération d\'un quiz...')
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
                contents: [{ parts: [{ text: "Génère une question de quiz MCQ courte en français avec 3 choix (A, B, C) et la réponse à la fin." }] }]
            })
            reply(`📝 *QUIZ ELY-BOT*:\n\n${response.data.candidates[0].content.parts[0].text}`)
        } catch (e) {
            reply('❌ Erreur quiz.')
        }
    }
}
