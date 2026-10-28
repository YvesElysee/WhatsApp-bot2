module.exports = {
    name: 'autoreact',
    category: 'settings',
    desc: 'Active ou désactive les réactions automatiques.',
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire.')
        if (!args[0]) return reply('Usage: .autoreact [on/off]')

        if (args[0] === 'on') {
            global.db.settings.autoreact = true
            // silencieux
        } else if (args[0] === 'off') {
            global.db.settings.autoreact = false
            // silencieux
        } else {
            reply('Usage: .autoreact [on/off]')
        }
    }
}
