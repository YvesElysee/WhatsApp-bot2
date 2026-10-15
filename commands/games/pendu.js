const { demanderSuite, essaisPour, partieEnCours, difficulteDe } = require('../../lib/jeux')

const sansAccents = (s) => String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-ZÀ-ÿ]/g, '')

// Vies selon le niveau (`.niveau`) — à 3 vies restantes, le bot
// révèle automatiquement une lettre du mot (indice bonus).
const ESSAIS = { facile: 9, moyen: 6, difficile: 4 }

const MOTS_REPLI = ['BONJOUR', 'AMIGOS', 'MAISON', 'VOITURE', 'SOLEIL', 'MUSIQUE', 'HISTOIRE', 'JARDIN']

module.exports = {
    name: 'pendu',
    category: 'games',
    desc: 'Jeu du pendu (l\'IA choisit le mot, tout le monde joue).',
    run: async (sock, m, args, { reply, getAIResponse }) => {
        const from = m.key.remoteJid
        if (partieEnCours(from)) return reply('❌ Une partie est déjà en cours ici ! Utilisez `.stopgame`.')

        const niveau = difficulteDe(from)
        await reply(`🎭 L'IA prépare un mot (${niveau.toUpperCase()})...`)

        const construirePartie = async () => {
            const prompt =
                'Génère un mot commun en français de 4 à 10 lettres ainsi qu\'un indice. ' +
                'Réponds UNIQUEMENT en JSON strict : {"word":"...","hint":"..."}'
            const res = await getAIResponse(prompt)
            const brut = res?.out || (typeof res === 'string' ? res : '')
            if (!brut) throw new Error('Réponse IA vide')

            const propre = String(brut).replace(/```json|```/g, '').trim()
            const debut = propre.indexOf('{')
            const fin = propre.lastIndexOf('}')
            let data = null
            if (debut !== -1 && fin !== -1) {
                try { data = JSON.parse(propre.substring(debut, fin + 1)) } catch (e) { /* repli ci-dessous */ }
            }

            let word = sansAccents(data?.word || '')
            if (word.length < 4 || word.length > 10) {
                word = MOTS_REPLI[Math.floor(Math.random() * MOTS_REPLI.length)]
            }
            return { word, hint: data?.hint || 'Indice disponible auprès de l\'IA.' }
        }

        // Nouvelle manche (réutilisée par « on continue ? »)
        const lancerManche = async (repondre, ctxM) => {
            const { word, hint } = await construirePartie()

            const game = {
                type: 'pendu',
                word,
                hint,
                display: word.split('').map(() => '_'),
                attempts: essaisPour(from, ESSAIS),
                used: []
            }

            const render = () => {
                let t = `🧩 *PENDU MULTIJOUEUR*\n\n`
                t += `💡 *Indice :* ${game.hint}\n\n`
                t += `Mot : \`${game.display.join(' ')}\`\n`
                t += `🎚️ Niveau *${niveau.toUpperCase()}* — ❤️ Vies restantes : ${game.attempts}\n`
                t += `🔠 Lettres utilisées : ${game.used.length ? game.used.join(' ') : '—'}\n\n`
                t += `👉 *Envoyez une lettre !*`
                return t
            }

            game.listener = async (sock2, m2, { body, sender, reply: r }) => {
                const partie = global.db.games[from]
                if (!partie || partie.type !== 'pendu') return
                const char = String(body || '').toUpperCase().trim()
                if (char.length !== 1 || !/[A-Z]/.test(char)) return
                if (partie.used.includes(char)) return r('🔁 Cette lettre a déjà été essayée !')

                partie.used.push(char)

                const revelerUneLettre = () => {
                    // Indice bonus : on dévoile une lettre encore cachée
                    const cachees = []
                    for (let i = 0; i < partie.word.length; i++) {
                        if (!partie.display.includes(partie.word[i])) cachees.push(partie.word[i])
                    }
                    const unique = [...new Set(cachees)]
                    if (!unique.length) return null
                    const lettre = unique[Math.floor(Math.random() * unique.length)]
                    for (let i = 0; i < partie.word.length; i++) {
                        if (partie.word[i] === lettre) partie.display[i] = lettre
                    }
                    return lettre
                }

                if (partie.word.includes(char)) {
                    for (let i = 0; i < partie.word.length; i++) {
                        if (partie.word[i] === char) partie.display[i] = char
                    }
                    if (!partie.display.includes('_')) {
                        const bilan = `🎉 *VICTOIRE COLLECTIVE !*\n\nLe mot était : *${partie.word}*`
                        delete global.db.games[from]
                        return demanderSuite(from, r, bilan, () => lancerManche(r, m2))
                    }
                    await r(render())
                } else {
                    partie.attempts--
                    if (partie.attempts <= 0) {
                        const bilan = `💀 *DÉFAITE !*\nLe mot était : *${partie.word}*`
                        delete global.db.games[from]
                        return demanderSuite(from, r, bilan, () => lancerManche(r, m2))
                    }
                    // Indice bonus quand il ne reste plus que 3 vies
                    let bonus = ''
                    if (partie.attempts === 3) {
                        const lettre = revelerUneLettre()
                        if (lettre) bonus = `\n💡 *Indice bonus :* la lettre *${lettre}* est dans le mot !`
                        if (!partie.display.includes('_')) {
                            const bilan = `🎉 *VICTOIRE COLLECTIVE !* (grâce à l'indice bonus)\n\nLe mot était : *${partie.word}*`
                            delete global.db.games[from]
                            return demanderSuite(from, r, bilan, () => lancerManche(r, m2))
                        }
                    }
                    await r(render() + bonus)
                }
            }

            global.db.games[from] = game
            await repondre(render() + '\n\n_Pour arrêter, tapez_ `.stopgame`')
        }

        try {
            await lancerManche(reply, m)
        } catch (e) {
            console.error('[PENDU]', e.message)
            reply('❌ Erreur de génération du Pendu. Réessayez dans un instant.')
        }
    }
}
