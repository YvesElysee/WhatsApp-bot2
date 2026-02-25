module.exports = {
    name: 'antistatus',
    category: 'settings',
    desc: 'Active/Désactive l\'Anti-Delete des statuts.',
    commands: ['antistatus', 'antideletestatus'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Cette commande est réservée au propriétaire.')
        if (!args[0]) return reply('Usage: .antistatus [on/off]')

        if (args[0] === 'on') {
            global.db.settings.statusAntidelete = true
            reply('🚨 *Anti-Delete Statut activé*.\nLe bot vous enverra les statuts supprimés par vos contacts.')
        } else if (args[0] === 'off') {
            global.db.settings.statusAntidelete = false
            reply('🚨 *Anti-Delete Statut désactivé*.')
        } else {
            reply('Usage: .antistatus [on/off]')
        }
    }
}
