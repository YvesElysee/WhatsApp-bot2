module.exports = {
    name: 'guess',
    run: async (sock, m, args, { reply }) => {
        const from = m.key.remoteJid
        const secret = Math.floor(Math.random() * 10) + 1

        global.db.games[from] = {
            type: 'guess',
            data: secret,
            listener: async (sock, m, { body, sender, reply }) => {
                const guess = parseInt(body)
                if (isNaN(guess)) return

                if (guess === secret) {
                    reply('🎉 BRAVO ! C\'était bien ' + secret)
                    delete global.db.games[from]
                } else if (guess < secret) {
                    reply('📈 C\'est PLUS !')
                } else {
                    reply('📉 C\'est MOINS !')
                }
            }
        }
        reply('🔢 J\'ai choisi un nombre entre 1 et 10. Devinez-le !')
    }
}
