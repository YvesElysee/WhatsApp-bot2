module.exports = {
    name: 'aionly',
    category: 'settings',
    desc: 'Restreint l\'usage de l\'IA au propriétaire.',
    commands: ['aionly', 'aiowner'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire du bot.')

        if (!args[0]) return reply('🤖 Utilisation : `.aionly on` ou `.aionly off`')

        if (args[0] === 'on') {
            global.db.settings.aiOnly = true
            reply('✅ L\'IA est désormais réservée au propriétaire.')
        } else if (args[0] === 'off') {
            global.db.settings.aiOnly = false
            reply('✅ L\'IA est désormais accessible à tous.')
        } else {
            reply('🤖 Utilisation : `.aionly on` ou `.aionly off`')
        }
    }
}
