module.exports = {
    name: 'statuslike',
    category: 'settings',
    desc: 'Active/Désactive le like automatique des statuts.',
    commands: ['statuslike', 'autolike'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire.')
        if (!args[0]) return reply('Usage: .statuslike [on/off]')

        if (args[0] === 'on') {
            global.db.settings.statusLike = true
            reply('❤️ *Auto-Like des statuts activé*.\nLe bot aimera désormais les statuts automatiquement.')
        } else if (args[0] === 'off') {
            global.db.settings.statusLike = false
            reply('❤️ *Auto-Like des statuts désactivé*.')
        } else {
            reply('Usage: .statuslike [on/off]')
        }
    }
}
