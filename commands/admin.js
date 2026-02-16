module.exports = {
    name: 'admin',
    commands: ['admin', 'kick', 'add', 'promote', 'demote', 'hidetag'],
    run: async (sock, m, args, { reply, text, isAdmins, isBotAdmins, isGroup }) => {
        const command = m.text.split(' ')[0].slice(1).toLowerCase()

        if (command === 'admin') {
            const adminMenu = `
👑 *Ely-bot Admin Menu* 👑

Commandes réservées aux administrateurs de groupe :

- .kick @user : Retirer un membre
- .promote @user : Nommer admin
- .demote @user : Retirer admin
- .hidetag [message] : Notification silencieuse pour tous
- .add [numéro] : Ajouter un membre (si possible)

*Note :* Le bot doit être admin pour que cela fonctionne.
            `
            return reply(adminMenu.trim())
        }

        if (!isGroup) return reply('Commande réservée aux groupes.')
        if (!isAdmins) return reply('❌ Vous n\'êtes pas admin !')
        if (!isBotAdmins) return reply('❌ Je dois être admin du groupe pour faire ça !')

        const users = m.mentionedJid[0] ? m.mentionedJid : m.quoted ? [m.quoted.sender] : []
        if (users.length === 0 && command !== 'hidetag') return reply('Mentionnez quelqu\'un ou répondez à un message.')

        try {
            if (command === 'kick') {
                await sock.groupParticipantsUpdate(m.key.remoteJid, users, 'remove')
                reply(`Au revoir ! 👋`)
            }
            else if (command === 'promote') {
                await sock.groupParticipantsUpdate(m.key.remoteJid, users, 'promote')
                reply(`Félicitations pour la promotion ! 🌟`)
            }
            else if (command === 'demote') {
                await sock.groupParticipantsUpdate(m.key.remoteJid, users, 'demote')
                reply(`Rétrogradé.`)
            }
            else if (command === 'hidetag') {
                if (!text) return reply('Quel message voulez-vous envoyer ?')
                const groupMetadata = await sock.groupMetadata(m.key.remoteJid)
                const participants = groupMetadata.participants.map(v => v.id)
                sock.sendMessage(m.key.remoteJid, { text: text, mentions: participants })
            }
        } catch (e) {
            console.error(e)
            reply('Erreur lors de l\'exécution de la commande admin.')
        }
    }
}
