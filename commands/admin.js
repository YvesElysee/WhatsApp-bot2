module.exports = {
    name: 'admin',
    commands: ['kick', 'add', 'promote', 'demote', 'hidetag'],
    run: async (sock, m, args, { reply, text, isAdmins, isBotAdmins, isGroup }) => {
        const command = m.text.split(' ')[0].slice(1).toLowerCase()

        if (!isGroup) return reply('This command is for groups only.')
        if (!isAdmins) return reply('You need to be an admin to use this.')
        if (!isBotAdmins) return reply('I need to be an admin to execute this.')

        const users = m.mentionedJid[0] ? m.mentionedJid : m.quoted ? [m.quoted.sender] : []
        if (users.length === 0 && command !== 'hidetag') return reply('Please mention a user or reply to a message.')

        if (command === 'kick') {
            await sock.groupParticipantsUpdate(m.key.remoteJid, users, 'remove')
            reply(`Kicked ${users.length} user(s).`)
        }
        else if (command === 'pid') {
            // hidden fun command?
        }
        else if (command === 'promote') {
            await sock.groupParticipantsUpdate(m.key.remoteJid, users, 'promote')
            reply(`Promoted ${users.length} user(s).`)
        }
        else if (command === 'demote') {
            await sock.groupParticipantsUpdate(m.key.remoteJid, users, 'demote')
            reply(`Demoted ${users.length} user(s).`)
        }
        else if (command === 'hidetag') {
            if (!text) return reply('Provide text to tag.')
            const groupMetadata = await sock.groupMetadata(m.key.remoteJid)
            const participants = groupMetadata.participants.map(v => v.id)
            sock.sendMessage(m.key.remoteJid, { text: text, mentions: participants })
        }
    }
}
