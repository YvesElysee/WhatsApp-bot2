const fallbacks = [
    { q: "Quelle est la capitale de la France ?", a: "Lyon", b: "Marseille", c: "Paris", d: "Bordeaux", correct: "C" },
    { q: "Qui a peint la Joconde ?", a: "Van Gogh", b: "Monet", c: "Picasso", d: "Léonard de Vinci", correct: "D" },
    { q: "Quel est le plus grand océan du monde ?", a: "Atlantique", b: "Indien", c: "Pacifique", d: "Arctique", correct: "C" },
    { q: "Quelle est la monnaie du Japon ?", a: "Yuan", b: "Yen", c: "Won", d: "Dollar", correct: "B" },
    { q: "En quelle année a commencé la Seconde Guerre mondiale ?", a: "1914", b: "1939", c: "1945", d: "1918", correct: "B" },
    { q: "Quel est l'élément chimique au symbole 'Au' ?", a: "Argent", b: "Aluminium", c: "Or", d: "Cuivre", correct: "C" },
    { q: "Qui a écrit 'Les Misérables' ?", a: "Victor Hugo", b: "Émile Zola", c: "Gustave Flaubert", d: "Albert Camus", correct: "A" }
]

module.exports = {
    name: 'quiz',
    category: 'games',
    desc: 'Jeu de quiz de culture générale.',
    run: async (sock, m, args, { reply, getAIResponse }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Un jeu est déjà en cours !')

        reply('🎲 Génération d\'un Quiz...')

        let quiz
        try {
            const prompt = "Génère une question de culture générale difficile en français avec 4 choix (A, B, C, D) et indique la lettre de la bonne réponse. Réponds UNIQUEMENT en JSON: {\"q\": \"...\", \"a\": \"...\", \"b\": \"...\", \"c\": \"...\", \"d\": \"...\", \"correct\": \"A\"}"
            const result = await getAIResponse(prompt)

            if (result) {
                const cleanJson = result.replace(/```json|```/g, '').trim()
                const jsonStart = cleanJson.indexOf('{')
                const jsonEnd = cleanJson.lastIndexOf('}')
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    quiz = JSON.parse(cleanJson.substring(jsonStart, jsonEnd + 1))
                }
            }
        } catch (e) {
            console.error('[QUIZ AI ERROR]', e)
        }

        // Fallback if AI fails or returns invalid JSON
        if (!quiz || !quiz.q || !quiz.correct) {
            console.log('[QUIZ] Using fallback question.')
            quiz = fallbacks[Math.floor(Math.random() * fallbacks.length)]
        }

        const msg = `📝 *QUIZ MULTIJOUEUR*\n\n*Question:* ${quiz.q}\n\nA. ${quiz.a}\nB. ${quiz.b}\nC. ${quiz.c}\nD. ${quiz.d}\n\n👉 *Le premier qui répond gagne !*`

        global.db.games[from] = {
            type: 'quiz',
            correct: quiz.correct.toUpperCase().trim(),
            scores: {},
            listener: async (sock, m, { body, sender, reply }) => {
                const game = global.db.games[from]
                const answer = body.toUpperCase().trim()

                // Flexible answer matching (A, A., or A [text])
                const isCorrect = answer === game.correct ||
                    answer.startsWith(game.correct + '.') ||
                    answer.startsWith(game.correct + ' ')

                if (isCorrect) {
                    reply(`🎉 @${sender.split('@')[0]} a trouvé la bonne réponse ! C'était bien *${game.correct}*.`, { mentions: [sender] })
                    delete global.db.games[from]
                }
            }
        }
        reply(msg)
    }
}
