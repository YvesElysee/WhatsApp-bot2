module.exports = {
    name: 'tagall',
    category: 'admin',
    desc: 'Mentionne tous les membres du groupe.',
    run: async (sock, m, args, { reply, isAdmins, isGroup, text }) => {
        if (!isGroup) return reply('❌ Commande réservée aux groupes.')
        if (!isAdmins) return reply('❌ Vous n\'êtes pas admin !')

        const groupMetadata = await sock.groupMetadata(m.key.remoteJid)
        const participants = groupMetadata.participants
        let message = `📣 *ALERTE GÉNÉRALE*\n\n`
        message += `📝 *Message:* ${text || 'Aucun'}\n\n`

        participants.forEach(p => {
            message += `@${p.id.split('@')[0]} `
        })

        sock.sendMessage(m.key.remoteJid, { text: message, mentions: participants.map(p => p.id) }, { quoted: m })
    }
}
