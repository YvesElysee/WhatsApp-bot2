module.exports = {
    name: 'mute',
    category: 'admin',
    desc: 'Ferme le groupe (seuls les admins peuvent parler).',
    run: async (sock, m, args, { reply, isAdmins, isBotAdmins, isGroup }) => {
        if (!isGroup) return reply('❌ Commande réservée aux groupes.')
        if (!isAdmins) return reply('❌ Vous n\'êtes pas admin !')
        if (!isBotAdmins) return reply('❌ Le bot doit être admin pour fermer le groupe.')

        await sock.groupSettingUpdate(m.key.remoteJid, 'announcement')
        reply('✅ Le groupe est maintenant fermé. Seuls les admins peuvent envoyer des messages.')
    }
}
