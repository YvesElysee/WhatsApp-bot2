const sansAccents = (s) => String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-ZÀ-ÿ]/g, '')

module.exports = {
    name: 'pendu',
    category: 'games',
    desc: 'Jeu du pendu (l\'IA choisit le mot, tout le monde joue).',
    run: async (sock, m, args, { reply, getAIResponse }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Une partie est déjà en cours ici ! Utilisez `.stopgame`.')

        await reply('🎭 L\'IA prépare un mot...')

        try {
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
                // Repli : mot valide hors IA
                const mots = ['BONJOUR', 'AMIGOS', 'MAISON', 'VOITURE', 'SOLEIL', 'MUSIQUE', 'HISTOIRE', 'JARDIN']
                word = mots[Math.floor(Math.random() * mots.length)]
            }
            const hint = data?.hint || 'Indice disponible auprès de l\'IA.'

            const game = {
                type: 'pendu',
                word,
                hint,
                display: word.split('').map(() => '_'),
                attempts: 8,
                used: []
            }

            const render = () => {
                let t = `🧩 *PENDU MULTIJOUEUR*\n\n`
                t += `💡 *Indice :* ${game.hint}\n\n`
                t += `Mot : \`${game.display.join(' ')}\`\n`
                t += `❤️ Essais restants : ${game.attempts}\n`
                t += `🔠 Lettres utilisées : ${game.used.length ? game.used.join(' ') : '—'}\n\n`
                t += `👉 *Envoyez une lettre !*`
                return t
            }

            game.listener = async (sock2, m2, { body, sender, reply: r }) => {
                const partie = global.db.games[from]
                if (!partie) return
                const char = String(body || '').toUpperCase().trim()
                if (char.length !== 1 || !/[A-Z]/.test(char)) return
                if (partie.used.includes(char)) return r('🔁 Cette lettre a déjà été essayée !')

                partie.used.push(char)

                if (partie.word.includes(char)) {
                    for (let i = 0; i < partie.word.length; i++) {
                        if (partie.word[i] === char) partie.display[i] = char
                    }
                    if (!partie.display.includes('_')) {
                        await r(`🎉 *VICTOIRE COLLECTIVE !*\n\nLe mot était : *${partie.word}*`)
                        delete global.db.games[from]
                    } else {
                        await r(render())
                    }
                } else {
                    partie.attempts--
                    if (partie.attempts <= 0) {
                        await r(`💀 *DÉFAITE !*\nLe mot était : *${partie.word}*`)
                        delete global.db.games[from]
                    } else {
                        await r(render())
                    }
                }
            }

            global.db.games[from] = game

            await reply(render() + '\n\n_Pour arrêter, tapez_ `.stopgame`')
        } catch (e) {
            console.error('[PENDU]', e.message)
            reply('❌ Erreur de génération du Pendu. Réessayez dans un instant.')
        }
    }
}
