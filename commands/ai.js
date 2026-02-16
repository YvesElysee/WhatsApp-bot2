const axios = require('axios')
const { translate } = require('google-translate-api-x')
const config = require('../config') // Import config to get API Key

module.exports = {
    name: 'ai',
    commands: ['ai', 'translate'],
    run: async (sock, m, args, { reply, text }) => {
        const command = m.text.split(' ')[0].slice(1).toLowerCase()

        if (command === 'ai') {
            if (!text) return reply('🤖 Posez-moi une question ! Exemple: .ai Quelle est la capitale du Cameroun ?')

            // Check for API Key
            const apiKey = config.OPENAI_API_KEY
            if (!apiKey || apiKey.startsWith('sk-proj-...')) {
                return reply(`⚠️ *Configuration Requise* ⚠️\n\nPour que l'IA fonctionne, vous devez ajouter une clé API OpenAI.\n1. Allez sur https://platform.openai.com/api-keys\n2. Copiez votre clé (sk-...)\n3. Collez-la dans le fichier 'config.js' ou dans '.env' sous le nom OPENAI_API_KEY.\n\nEn attendant, voici une réponse simulée : "Je suis Ely-bot, mais mon cerveau n'est pas encore connecté !"`)
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
                reply(`🤖 *Ely-bot AI*:\n${aiReply}`)

            } catch (e) {
                console.error(e)
                reply('Erreur avec l\'API IA. Vérifiez votre clé ou votre solde.')
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
