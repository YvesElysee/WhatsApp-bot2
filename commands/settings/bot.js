module.exports = {
    name: 'bot',
    category: 'settings',
    desc: 'Active ou désactive le bot.',
    commands: ['bot', 'botstatus'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Seul le propriétaire peut éteindre/allumer le bot.')
        if (!args[0]) return reply('Usage: .bot [on/off]')

        if (args[0] === 'on') {
            global.db.settings.active = true
            reply('✅ *Bot allumé*. Il répondra désormais à toutes les commandes.')
        } else if (args[0] === 'off') {
            global.db.settings.active = false
            reply('💤 *Bot éteint*. Il ne répondra plus qu\'au propriétaire.')
        } else {
            reply('Usage: .bot [on/off]')
        }
    }
}
