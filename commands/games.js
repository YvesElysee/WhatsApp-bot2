const axios = require('axios')
module.exports = {
    name: 'games',
    commands: ['games', 'truth', 'dare', 'guess', 'quiz', 'devine'],
    run: async (sock, m, args, { reply, text }) => {
        const command = m.text.split(' ')[0].slice(1).toLowerCase()

        if (command === 'games') {
            const menu = `
╔══════════════════╗
║     *🎮 ARCADE*      ║
╚══════════════════╝

▸ .guess : _Devinement de nombre_
▸ .truth : _Vérité_
▸ .dare : _Défi_
▸ .quiz : _Quiz Culture (IA)_
▸ .devine : _Devinette (IA)_

_Amusez-vous bien avec Ely!_
            `
            await reply(menu.trim())
        }

        else if (command === 'guess') {
            const secret = Math.floor(Math.random() * 10) + 1
            if (!text) return reply('🔢 Devinez un nombre entre 1 et 10 ! Exemple: .guess 5')
            const userGuess = parseInt(text)
            if (isNaN(userGuess)) return reply('❌ Ce n\'est pas un nombre !')

            if (userGuess === secret) {
                reply(`🎉 *GAGNÉ* ! Le nombre était bien ${secret}.`)
            } else {
                reply(`❌ *PERDU* ! Le nombre était ${secret}. Essaie encore !`)
            }
        }

        else if (command === 'quiz') {
            const geminiKey = process.env.GEMINI_API_KEY
            if (!geminiKey) return reply('⚠️ Gemini n\'est pas configuré pour les jeux IA.')

            try {
                reply('🎯 Génération du quiz...')
                const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
                    contents: [{ parts: [{ text: "Génère une question de quiz MCQ courte et amusante en français. Donne la réponse à la fin." }] }]
                })
                reply(`📝 *QUIZ ELY-BOT*:\n\n${response.data.candidates[0].content.parts[0].text}`)
            } catch (e) {
                reply('Erreur lors du lancement du quiz.')
            }
        }

        else if (command === 'devine') {
            const geminiKey = process.env.GEMINI_API_KEY
            if (!geminiKey) return reply('⚠️ Gemini n\'est pas configuré pour les jeux IA.')

            try {
                reply('⏳ Recherche d\'une devinette...')
                const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
                    contents: [{ parts: [{ text: "Génère une devinette courte en français. Donne la réponse à la fin cachée par ||." }] }]
                })
                reply(`🧩 *DEVINETTE*:\n\n${response.data.candidates[0].content.parts[0].text}`)
            } catch (e) {
                reply('Erreur lors du lancement de la devinette.')
            }
        }

        else if (command === 'truth') {
            const truths = ["Quel est ton plus grand secret ?", "Ton pire moment de honte ?", "Qui aimes-tu en secret ?"]
            reply('🤫 *Vérité*: ' + truths[Math.floor(Math.random() * truths.length)])
        }

        else if (command === 'dare') {
            const dares = ["Envoie un message vocal flippant", "Envoie une photo de tes pieds (humour)", "Chante en voc"]
            reply('🔥 *Défi*: ' + dares[Math.floor(Math.random() * dares.length)])
        }
    }
}
