module.exports = {
    name: 'promote',
    category: 'admin',
    desc: 'Promeut un membre au rang d\'administrateur.',
    run: async (sock, m, args, { reply, isAdmins, isBotAdmins, isGroup }) => {
        if (!isGroup) return reply('❌ Commande réservée aux groupes.')
        if (!isAdmins) return reply('❌ Vous n\'êtes pas admin !')
        if (!isBotAdmins) return reply('❌ Je dois être admin.')

        const user = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
        if (!user) return reply('❌ Mentionnez quelqu\'un.')

        try {
            await sock.groupParticipantsUpdate(m.key.remoteJid, [user], 'promote')
            reply('✅ Utilisateur promu admin.')
        } catch (e) {
            reply('❌ Échec.')
        }
    }
}
