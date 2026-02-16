const axios = require('axios')
const { translate } = require('google-translate-api-x')
const config = require('../config') // Import config to get API Key

module.exports = {
    name: 'ai',
    commands: ['ai', 'gemini', 'translate'],
    run: async (sock, m, args, { reply, text }) => {
        const command = m.text.split(' ')[0].slice(1).toLowerCase()

        if (command === 'ai') {
            if (!text) return reply('🤖 Posez-moi une question ! Exemple: .ai Quelle est la capitale du Cameroun ?')

            // Check for API Key
            const apiKey = config.OPENAI_API_KEY
            if (!apiKey || apiKey === 'sk-proj-...' || apiKey.length < 10) {
                console.log(`[WARN] Invalid OpenAI API Key detected: ${apiKey ? (apiKey.substring(0, 7) + '...') : 'NULL'}`)
                return reply(`⚠️ *Clé API Manquante* ⚠️\n\nLe bot ne trouve pas votre clé OpenAI.\n\n**Sur Render :**\n1. Allez dans *Environment*.\n2. Ajoutez \`OPENAI_API_KEY\` avec votre clé.\n3. Cliquez sur *Save Changes*.\n\nLe bot redémarrera automatiquement. En attendant, utilisez \`.gemini\` !`)
            }

            try {
                // Real OpenAI Call Example
                const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: text }]
                }, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                })

                const aiReply = response.data.choices[0].message.content
                reply(`🤖 *Ely-bot AI (GPT)*:\n${aiReply}`)

            } catch (e) {
                console.error(e)
                if (e.response && e.response.status === 429) {
                    reply('⚠️ *Limite atteinte (OpenAI 429)*: Trop de requêtes ou crédit épuisé. Essayez d\'utiliser Gemini si configuré.')
                } else {
                    reply('Erreur avec l\'API OpenAI. Vérifiez votre clé ou votre solde.')
                }
            }
        }

        else if (command === 'gemini') {
            if (!text) return reply('🤖 Posez-moi une question ! Exemple: .gemini Qui est Steve Jobs ?')
            const geminiKey = process.env.GEMINI_API_KEY
            if (!geminiKey) return reply('⚠️ Clé GEMINI_API_KEY manquante dans le .env.')

            try {
                reply('💭 Réflexion...')
                const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
                    contents: [{ parts: [{ text: text }] }]
                })
                const geminiReply = response.data.candidates[0].content.parts[0].text
                reply(`✨ *Ely-bot AI (Gemini)*:\n${geminiReply}`)
            } catch (e) {
                console.error(e)
                reply('Erreur avec l\'API Gemini.')
            }
        }

        else if (command === 'translate') {
            if (!text) return reply('Usage: .translate [lang] [text]')
            const lang = args[0]
            const data = args.slice(1).join(' ')
            if (!data) return reply('Texte manquant. Exemple: .translate fr Hello')

            try {
                const res = await translate(data, { to: lang })
                reply(`*Traduction (${lang}):*\n${res.text}`)
            } catch (e) {
                reply('Erreur de traduction. Vérifiez le code langue (fr, en, es, de...).')
            }
        }
    }
}
