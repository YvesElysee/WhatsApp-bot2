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
    desc: 'Quiz de culture générale (tout le monde répond).',
    run: async (sock, m, args, { reply, getAIResponse }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Un jeu est déjà en cours ici ! Utilisez `.stopgame`.')

        await reply('🎲 Génération d\'un quiz...')

        let quiz = null
        try {
            const prompt =
                'Génère une question de culture générale en français avec 4 choix (A, B, C, D) ' +
                'et indique la lettre de la bonne réponse. ' +
                'Réponds UNIQUEMENT en JSON strict : ' +
                '{"q":"...","a":"...","b":"...","c":"...","d":"...","correct":"A"}'

            const res = await getAIResponse(prompt)
            const brut = res?.out || (typeof res === 'string' ? res : '')
            if (brut) {
                const propre = String(brut).replace(/```json|```/g, '').trim()
                const debut = propre.indexOf('{')
                const fin = propre.lastIndexOf('}')
                if (debut !== -1 && fin !== -1) {
                    try { quiz = JSON.parse(propre.substring(debut, fin + 1)) } catch (e) { quiz = null }
                }
            }
        } catch (e) {
            console.error('[QUIZ IA]', e.message)
        }

        // Repli si l'IA échoue ou renvoie un JSON invalide
        if (!quiz || !quiz.q || !quiz.correct || !quiz.a || !quiz.b || !quiz.c || !quiz.d) {
            quiz = fallbacks[Math.floor(Math.random() * fallbacks.length)]
        }

        const correct = String(quiz.correct).trim().toUpperCase().charAt(0)

        const msg =
            `📝 *QUIZ MULTIJOUEUR*\n\n` +
            `*Question :* ${quiz.q}\n\n` +
            `A. ${quiz.a}\nB. ${quiz.b}\nC. ${quiz.c}\nD. ${quiz.d}\n\n` +
            `👉 *Le premier à répondre gagne !* (tapez la lettre, ex: \`C\`)`

        global.db.games[from] = {
            type: 'quiz',
            correct,
            listener: async (sock2, m2, { body, sender, reply: r }) => {
                const partie = global.db.games[from]
                if (!partie) return
                const answer = String(body || '').trim().toUpperCase()

                const isCorrect =
                    answer === partie.correct ||
                    answer.startsWith(partie.correct + '.') ||
                    answer.startsWith(partie.correct + ' ')

                if (isCorrect) {
                    await r(`🎉 @${global.jidToNumber(sender)} a trouvé la bonne réponse ! C'était bien *${partie.correct}*.`, { mentions: [sender] })
                    delete global.db.games[from]
                }
            }
        }

        await reply(msg)
    }
}
