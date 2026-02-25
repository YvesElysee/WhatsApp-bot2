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
            reply('👀 *Auto-View des statuts activé*.\nLe bot marquera désormais les statuts comme vus automatiquement.')
        } else if (args[0] === 'off') {
            global.db.settings.statusView = false
            reply('👀 *Auto-View des statuts désactivé*.')
        } else {
            reply('Usage: .statusview [on/off]')
        }
    }
}
