const axios = require('axios')
const { translate } = require('google-translate-api-x')

module.exports = {
    name: 'ai',
    commands: ['ai', 'truth', 'dare', 'translate'],
    run: async (sock, m, args, { reply, text }) => {
        const command = m.text.split(' ')[0].slice(1).toLowerCase()

        if (command === 'ai') {
            if (!text) return reply('Ask me something! Example: .ai Who is the president of France?')
            try {
                // Using a free API endpoint (e.g., simsimi or alternative) 
                // Or standard OpenAI if key provided. 
                // For this demo, I will use a placeholder or a very simple free API if available.
                // Let's use a mock AI response for stability unless a key is configured.

                // If you want real AI, you need an API Key.
                // reply('AI feature requires an API Key. Please configure it.')

                // Simulating AI for user satisfaction in this demo:
                reply(`[AI Mock] That is an interesting question about "${text}". I am still learning!`)
            } catch (e) {
                reply('Error with AI service.')
            }
        }

        else if (command === 'truth') {
            const truths = [
                "What is your biggest fear?",
                "Have you ever lied to your best friend?",
                "What is the most embarrassing thing you've done?",
                "Who is your crush?"
            ]
            const random = truths[Math.floor(Math.random() * truths.length)]
            reply(`*TRUTH*: ${random}`)
        }

        else if (command === 'dare') {
            const dares = [
                "Send a voice note singing a song.",
                "Change your profile picture to a monkey for 1 hour.",
                "Text your crush 'I love you'.",
                "Do 10 pushups and send video."
            ]
            const random = dares[Math.floor(Math.random() * dares.length)]
            reply(`*DARE*: ${random}`)
        }

        else if (command === 'translate') {
            if (!text) return reply('Usage: .translate [lang] [text]')
            const lang = args[0]
            const data = args.slice(1).join(' ')
            if (!data) return reply('Please provide text to translate.')

            try {
                const res = await translate(data, { to: lang })
                reply(`*Translation (${lang}):*\n${res.text}`)
            } catch (e) {
                reply('Error translating. Make sure the language code is correct (e.g., en, fr, es).')
            }
        }
    }
}
