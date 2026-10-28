module.exports = {
    name: 'statusview',
    category: 'settings',
    desc: 'Active/Désactive la vue automatique des statuts.',
    commands: ['statusview', 'autoview'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire.')
        if (!args[0]) return reply('Usage: .statusview [on/off]')

        if (args[0] === 'on') {
            global.db.settings.statusView = true
            // silencieux
        } else if (args[0] === 'off') {
            global.db.settings.statusView = false
            // silencieux
        } else {
            reply('Usage: .statusview [on/off]')
        }
    }
}
