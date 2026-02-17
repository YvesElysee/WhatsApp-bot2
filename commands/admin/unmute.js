module.exports = {
    name: 'unmute',
    category: 'admin',
    desc: 'Ouvre le groupe (tout le monde peut parler).',
    run: async (sock, m, args, { reply, isAdmins, isBotAdmins, isGroup }) => {
        if (!isGroup) return reply('❌ Commande réservée aux groupes.')
        if (!isAdmins) return reply('❌ Vous n\'êtes pas admin !')
        if (!isBotAdmins) return reply('❌ Le bot doit être admin pour ouvrir le groupe.')

        await sock.groupSettingUpdate(m.key.remoteJid, 'not_announcement')
        reply('✅ Le groupe est maintenant ouvert. Tout le monde peut envoyer des messages.')
    }
}
