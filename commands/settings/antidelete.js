module.exports = {
    name: 'antidelete',
    category: 'settings',
    desc: 'Active ou désactive l\'anti-suppression.',
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire.')
        if (!args[0]) return reply('Usage: .antidelete [on/off]')

        if (args[0] === 'on') {
            global.db.settings.antidelete = true
            reply('✅ Anti-delete activé !')
        } else if (args[0] === 'off') {
            global.db.settings.antidelete = false
            reply('❌ Anti-delete désactivé.')
        } else {
            reply('Usage: .antidelete [on/off]')
        }
    }
}
