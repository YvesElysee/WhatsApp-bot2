module.exports = {
    name: 'quiz',
    run: async (sock, m, args, { reply, getGeminiClient }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Un jeu est déjà en cours !')

        const client = getGeminiClient()
        if (!client) return reply('⚠️ Erreur SDK.')

        reply('🎲 Génération d\'un Quiz Multijoueur...')

        try {
            const prompt = "Génère une question de culture générale difficile en français avec 4 choix (A, B, C, D) et indique la lettre de la bonne réponse. Réponds UNIQUEMENT en JSON: {\"q\": \"...\", \"a\": \"...\", \"b\": \"...\", \"c\": \"...\", \"d\": \"...\", \"correct\": \"A\"}"
            const result = await client.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: prompt
            })

            const cleanJson = result.text.replace(/```json|```/g, '').trim()
            const quiz = JSON.parse(cleanJson)

            const msg = `📝 *QUIZ MULTIJOUEUR*\n\n*Question:* ${quiz.q}\n\nA. ${quiz.a}\nB. ${quiz.b}\nC. ${quiz.c}\nD. ${quiz.d}\n\n👉 *Le premier qui répond gagne !*`

            global.db.games[from] = {
                type: 'quiz',
                correct: quiz.correct.toUpperCase(),
                scores: {},
                listener: async (sock, m, { body, sender, reply }) => {
                    const game = global.db.games[from]
                    const answer = body.toUpperCase().trim()

                    if (answer === game.correct) {
                        reply(`🎉 @${sender.split('@')[0]} a trouvé la bonne réponse ! C'était bien *${game.correct}*.`, { mentions: [sender] })
                        delete global.db.games[from]
                    }
                }
            }
            reply(msg)
        } catch (e) {
            console.error(e)
            reply('❌ Erreur Quiz New SDK.')
        }
    }
}
