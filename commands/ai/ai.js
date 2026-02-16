const axios = require('axios')
const config = require('../../config')

module.exports = {
    name: 'ai',
    run: async (sock, m, args, { reply, text }) => {
        if (!text) return reply('🤖 Posez-moi une question !')
        const apiKey = config.OPENAI_API_KEY

        if (!apiKey || apiKey === 'sk-proj-...' || apiKey.length < 10) {
            return reply('⚠️ Clé OpenAI manquante ou invalide. Configurez `OPENAI_API_KEY` sur Render.')
        }

        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: text }]
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })

            reply(`🤖 *IA GPT*:\n\n${response.data.choices[0].message.content}`)
        } catch (e) {
            console.error(e)
            if (e.response && e.response.status === 429) {
                reply('⚠️ Limite OpenAI atteinte (429). Utilisez `.gemini` !')
            } else {
                reply('❌ Erreur OpenAI. Vérifiez votre solde.')
            }
        }
    }
}
