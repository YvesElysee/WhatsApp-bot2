const { demanderSuite, essaisPour, partieEnCours, difficulteDe } = require('../../lib/jeux')

const fallbacks = [
    { q: "Quelle est la capitale de la France ?", a: "Lyon", b: "Marseille", c: "Paris", d: "Bordeaux", correct: "C" },
    { q: "Qui a peint la Joconde ?", a: "Van Gogh", b: "Monet", c: "Picasso", d: "Léonard de Vinci", correct: "D" },
    { q: "Quel est le plus grand océan du monde ?", a: "Atlantique", b: "Indien", c: "Pacifique", d: "Arctique", correct: "C" },
    { q: "Quelle est la monnaie du Japon ?", a: "Yuan", b: "Yen", c: "Won", d: "Dollar", correct: "B" },
    { q: "En quelle année a commencé la Seconde Guerre mondiale ?", a: "1914", b: "1939", c: "1945", d: "1918", correct: "B" },
    { q: "Quel est l'élément chimique au symbole 'Au' ?", a: "Argent", b: "Aluminium", c: "Or", d: "Cuivre", correct: "C" },
    { q: "Qui a écrit 'Les Misérables' ?", a: "Victor Hugo", b: "Émile Zola", c: "Gustave Flaubert", d: "Albert Camus", correct: "A" }
]

const LETTRES = ['A', 'B', 'C', 'D']

// Essais autorisés selon le niveau (`.niveau`) : après épuisement,
// le bot donne la réponse et propose de continuer.
const ESSAIS = { facile: 3, moyen: 2, difficile: 1 }

// Filtre les messages qui ressemblent à une réponse (A, B., C…)
const extraireLettre = (texte) => {
    const t = String(texte || '').trim().toUpperCase()
    if (LETTRES.includes(t)) return t
    const m = t.match(/^([A-D])[.)\s]/)
    return m ? m[1] : null
}

module.exports = {
    name: 'quiz',
    category: 'games',
    desc: 'Quiz de culture générale (tout le monde répond).',
    run: async (sock, m, args, { reply, getAIResponse }) => {
        const from = m.key.remoteJid
        if (partieEnCours(from)) return reply('❌ Un jeu est déjà en cours ici ! Utilisez `.stopgame`.')

        const niveau = difficulteDe(from)
        const difficulteIA = {
            facile: 'très facile, accessible à tous',
            moyen: 'de difficulté moyenne',
            difficile: 'difficile et corsée, mais avec une réponse vérifiable'
        }[niveau]

        await reply(`🎲 Génération d'un quiz (${niveau.toUpperCase()})...`)

        // Nouvelle manche (réutilisée par « on continue ? »)
        const lancerManche = async (repondre) => {
            let quiz = null
            try {
                const prompt =
                    `Génère une question de culture générale en français ${difficulteIA}, avec 4 choix (A, B, C, D) ` +
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
            let essais = essaisPour(from, ESSAIS)

            const afficher = (elimines = []) => {
                const ligne = (lettre, texte) =>
                    elimines.includes(lettre) ? `${lettre}. ~~${texte}~~ ❌` : `${lettre}. ${texte}`
                return (
                    `📝 *QUIZ MULTIJOUEUR*\n\n` +
                    `*Question :* ${quiz.q}\n\n` +
                    `${ligne('A', quiz.a)}\n${ligne('B', quiz.b)}\n${ligne('C', quiz.c)}\n${ligne('D', quiz.d)}\n\n` +
                    `🎚️ Niveau *${niveau.toUpperCase()}* — ❤️ Essais restants : *${essais}*\n` +
                    `👉 *Le premier à répondre gagne !* (tapez la lettre, ex: \`C\`)\n` +
                    `_Pour arrêter, tapez_ \`.stopgame\``
                )
            }

            const elimines = []

            global.db.games[from] = {
                type: 'quiz',
                correct,
                listener: async (sock2, m2, { body, sender, reply: r }) => {
                    const partie = global.db.games[from]
                    if (!partie || partie.type !== 'quiz') return

                    const reponse = extraireLettre(body)
                    if (!reponse) return // message non lié au quiz : ignoré

                    if (reponse === partie.correct) {
                        const bilan = `🎉 @${global.jidToNumber(sender)} a trouvé la bonne réponse ! C'était bien *${partie.correct}*.`
                        delete global.db.games[from]
                        return demanderSuite(from, r, bilan, () => lancerManche(r), { mentions: [sender] })
                    }

                    // Mauvaise réponse : indice = on élimine un choix
                    essais--
                    if (essais > 0) {
                        if (!elimines.includes(reponse)) elimines.push(reponse)
                        await r(`❌ Faux ! L'option *${reponse}* est éliminée.\n\n` + afficher(elimines))
                    } else {
                        const bilan = `💤 Plus d'essais ! La bonne réponse était : *${partie.correct}*\n_${quiz[partie.correct.toLowerCase()]}_`
                        delete global.db.games[from]
                        await demanderSuite(from, r, bilan, () => lancerManche(r))
                    }
                }
            }

            await repondre(afficher(elimines))
        }

        await lancerManche(reply)
    }
}
