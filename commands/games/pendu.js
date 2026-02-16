module.exports = {
    name: 'pendu',
    run: async (sock, m, args, { reply }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Une partie est déjà en cours ici !')

        const words = ['WHATSAPP', 'ROBOT', 'JAVASCRIPT', 'GOOGLE', 'AI', 'CAMEROUN', 'ELYBOT', 'KING', 'DYNAMO']
        const word = words[Math.floor(Math.random() * words.length)]
        let display = word.split('').map(() => '_').join(' ')
        let attempts = 6
        let used = []

        const render = () => {
            return `🧩 *PENDU ELY-BOT*\n\nMot: \`${display}\`\nEssais: ${attempts} ❤️\nLettres: ${used.join(', ')}`
        }

        global.db.games[from] = {
            type: 'pendu',
            word,
            display: display.split(' '),
            attempts,
            used,
            listener: async (sock, m, { body, sender, reply }) => {
                const game = global.db.games[from]
                const char = body.toUpperCase().trim()
                if (char.length !== 1 || !/[A-Z]/.test(char)) return

                if (game.used.includes(char)) return reply('❌ Déjà utilisé !')
                game.used.push(char)

                if (game.word.includes(char)) {
                    for (let i = 0; i < game.word.length; i++) {
                        if (game.word[i] === char) game.display[i] = char
                    }
                    display = game.display.join(' ')

                    if (!game.display.includes('_')) {
                        reply(`🎉 GAGNÉ ! Le mot était *${game.word}* !`)
                        delete global.db.games[from]
                    } else {
                        reply(render())
                    }
                } else {
                    game.attempts--
                    if (game.attempts <= 0) {
                        reply(`💀 PERDU ! Le mot était *${game.word}*.`)
                        delete global.db.games[from]
                    } else {
                        reply(render())
                    }
                }
            }
        }

        reply(render() + '\n\nTapez une lettre pour deviner !')
    }
}
