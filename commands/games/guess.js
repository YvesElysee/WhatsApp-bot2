module.exports = {
    name: 'guess',
    category: 'games',
    desc: 'Devinez le nombre choisi par le bot.',
    commands: ['guess', 'devine-nombre'],
    run: async (sock, m, args, { reply }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Une partie est déjà en cours ici ! Utilisez `.stopgame`.')

        const secret = Math.floor(Math.random() * 100) + 1
        const sender = m.sender || m.key.participant || m.key.remoteJid

        global.db.games[from] = {
            type: 'guess',
            secret,
            tentatives: 0,
            listener: async (sock2, m2, { body, sender: joueur, reply }) => {
                const partie = global.db.games[from]
                if (!partie) return

                const nombre = parseInt(String(body || '').trim(), 10)
                if (isNaN(nombre)) return // on ignore tout ce qui n'est pas un chiffre

                partie.tentatives++

                if (nombre === partie.secret) {
                    await reply(`🎉 BRAVO @${global.jidToNumber(joueur)} !\n\nC'était bien *${partie.secret}* en ${partie.tentatives} tentative(s) !`, { mentions: [joueur] })
                    delete global.db.games[from]
                } else if (nombre < partie.secret) {
                    await reply(`📈 *PLUS !*\n_Vous cherchez en dessous. (essai n°${partie.tentatives})_`)
                } else {
                    await reply(`📉 *MOINS !*\n_Vous cherchez au-dessus. (essai n°${partie.tentatives})_`)
                }
            }
        }

        reply(
            `🔢 *DEVINE LE NOMBRE* 🔢\n\n` +
            `J'ai choisi un nombre entre *1 et 100*.\n` +
            `👉 @${global.jidToNumber(sender)}, envoyez vos propositions directement !\n\n` +
            `_Pour arrêter, tapez_ \`.stopgame\``,
            { mentions: [sender] }
        )
    }
}
