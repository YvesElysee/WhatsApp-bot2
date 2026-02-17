module.exports = {
    name: 'delete',
    category: 'admin',
    desc: 'Supprime un message (répondez au message à supprimer).',
    commands: ['delete', 'del'],
    run: async (sock, m, args, { reply, isAdmins, isBotAdmins, isGroup }) => {
        if (!m.quoted) return reply('❌ Répondez au message que vous souhaitez supprimer.')

        // If in group, check if user is admin or it's their own message
        // If not in group, owner can delete anything
        if (isGroup && !isAdmins && !m.quoted.key.fromMe) return reply('❌ Vous n\'êtes pas admin !')
        if (isGroup && !isBotAdmins && !m.quoted.key.fromMe) return reply('❌ Le bot doit être admin pour supprimer les messages des autres.')

        await sock.sendMessage(m.key.remoteJid, { delete: m.quoted.key })
    }
}
