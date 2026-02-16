module.exports = {
    name: 'kick',
    run: async (sock, m, args, { reply, isAdmins, isBotAdmins, isGroup }) => {
        if (!isGroup) return reply('❌ Commande réservée aux groupes.')
        if (!isAdmins) return reply('❌ Vous n\'êtes pas admin !')
        if (!isBotAdmins) return reply('❌ Je dois être admin pour retirer quelqu\'un.')

        const user = m.mentionedJid[0] || (m.quoted ? m.quoted.sender : null)
        if (!user) return reply('❌ Mentionnez un utilisateur ou répondez à son message.')

        try {
            await sock.groupParticipantsUpdate(m.key.remoteJid, [user], 'remove')
            reply('✅ Utilisateur retiré.')
        } catch (e) {
            console.error(e)
            reply('❌ Échec du retrait. Vérifiez mes permissions.')
        }
    }
}
