module.exports = {
    name: 'stopgame',
    commands: ['stopgame', 'quitgame', 'cancelgame'],
    run: async (sock, m, args, { reply, isAdmins, isOwner }) => {
        const from = m.key.remoteJid
        if (!global.db.games[from]) return reply('❌ Aucune partie n\'est en cours ici.')

        // Owner/Admins can always stop, players can stop their own (if applicable, but here we allow any command)
        // Since it's a prefix command, it's safer
        delete global.db.games[from]
        reply('✅ Partie arrêtée avec succès !')
    }
}
