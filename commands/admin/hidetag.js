module.exports = {
    name: 'hidetag',
    category: 'admin',
    desc: 'Notifie tous les membres du groupe sans les citer.',
    run: async (sock, m, args, { reply, text, isAdmins, isGroup }) => {
        if (!isGroup) return reply('❌ Commande réservée aux groupes.')
        if (!isAdmins) return reply('❌ Vous n\'êtes pas admin !')

        const groupMetadata = await sock.groupMetadata(m.key.remoteJid)
        const participants = groupMetadata.participants.map(v => v.id)

        sock.sendMessage(m.key.remoteJid, { text: text || 'Attention tout le monde ! 🔔', mentions: participants })
    }
}
