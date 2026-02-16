module.exports = {
    name: 'pendu',
    run: async (sock, m, args, { reply, getGeminiModel }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Une partie est déjà en cours !')

        const model = getGeminiModel()
        if (!model) return reply('⚠️ Erreur SDK.')

        reply('🎭 L\'IA prépare un Pendu Multijoueur...')

        try {
            const prompt = "Génère un mot commun en français (4-10 lettres) et un indice. Réponds en JSON: {\"word\": \"...\", \"hint\": \"...\"}"
            const result = await model.generateContent(prompt)
            const data = JSON.parse(result.response.text().replace(/```json|```/g, '').trim())

            const word = data.word.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            const game = {
                type: 'pendu',
                word,
                hint: data.hint,
                display: word.split('').map(() => '_'),
                attempts: 8,
                used: [],
                contributors: {}
            }

            const render = () => `🧩 *PENDU MULTIJOUEUR*\n\n💡 *Indice:* ${game.hint}\n\nMot: \`${game.display.join(' ')}\`\n❤️ Essais: ${game.attempts}\n🔠 Lettres: ${game.used.join(', ')}`

            global.db.games[from] = {
                ...game,
                listener: async (sock, m, { body, sender, reply }) => {
                    const game = global.db.games[from]
                    const char = body.toUpperCase().trim()
                    if (char.length !== 1 || !/[A-Z]/.test(char)) return
                    if (game.used.includes(char)) return

                    game.used.push(char)
                    if (game.word.includes(char)) {
                        for (let i = 0; i < game.word.length; i++) {
                            if (game.word[i] === char) game.display[i] = char
                        }
                        if (!game.display.includes('_')) {
                            reply(`🎉 *VICTOIRE COLLECTIVE !*\n\nLe mot était: *${game.word}*\n${render()}`)
                            delete global.db.games[from]
                        } else {
                            reply(render())
                        }
                    } else {
                        game.attempts--
                        if (game.attempts <= 0) {
                            reply(`💀 *DEFAITE !*\nLe mot était: *${game.word}*`)
                            delete global.db.games[from]
                        } else {
                            reply(render())
                        }
                    }
                }
            }
            reply(render() + '\n\n👉 *Tout le monde peut participer !*')
        } catch (e) {
            console.error(e)
            reply('❌ Erreur Pendu SDK.')
        }
    }
}
