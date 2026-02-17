module.exports = {
    name: 'mode',
    category: 'settings',
    desc: 'Change le mode du bot (Public/Privé).',
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire.')
        if (!args[0]) return reply('Usage: .mode [public/private]')

        if (args[0] === 'private') {
            global.db.settings.privateMode = true
            reply('🔒 Mode PRIVÉ activé. Le bot ne répondra qu\'en privé ou à l\'owner.')
        } else if (args[0] === 'public') {
            global.db.settings.privateMode = false
            reply('🔓 Mode PUBLIC activé. Le bot répondra à tout le monde.')
        } else {
            reply('Usage: .mode [public/private]')
        }
    }
}
