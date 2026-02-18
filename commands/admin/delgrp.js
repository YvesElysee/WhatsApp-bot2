module.exports = {
    name: 'delgrp',
    category: 'admin',
    desc: 'Supprime vos propres messages dans un groupe (localement ou à distance).',
    commands: ['delgrp', 'purge', 'cleanme'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Seul le propriétaire peut utiliser cette commande.')

        // Usage: .delgrp [nombre] ou .delgrp [jid] [nombre]
        let targetJid = m.key.remoteJid
        let count = parseInt(args[0])

        if (args.length >= 2 && args[0].includes('@')) {
            targetJid = args[0]
            count = parseInt(args[1])
        }

        if (isNaN(count) || count <= 0) return reply('❌ Veuillez indiquer un nombre de messages à supprimer. Exemple: `.delgrp 5` ou `.delgrp 12345@g.us 5`')
        if (count > 50) return reply('⚠️ Par sécurité, la limite est de 50 messages par purge.')

        reply(`⚙️ Tentative de suppression de *${count}* de vos messages dans *${targetJid}*...`)

        try {
            // On filtre les messages de l'expéditeur (m.sender) dans le jid cible
            const messages = Array.from(global.db.msgStore.values())
                .filter(item => item.from === targetJid && item.sender === m.sender)
                .reverse()
                .slice(0, count)

            if (messages.length === 0) {
                return reply('❌ Aucun message récent trouvé dans mes archives pour ce chat.')
            }

            reply(`⚙️ Suppression de *${messages.length}* messages en cours...`)

            let deleted = 0
            for (const msg of messages) {
                try {
                    await sock.sendMessage(targetJid, { delete: msg.m.key })
                    deleted++
                    // Petit délai pour éviter le spam/ban
                    await new Promise(res => setTimeout(res, 300))
                } catch (err) { }
            }

            // Réponse de succès redirigée si nécessaire par smartReply du handler
            reply(`✅ *PURGE RÉUSSIE*\nCible: \`${targetJid.split('@')[0]}\`\nMessages supprimés: *${deleted}*`)
        } catch (e) {
            console.error('[PURGE ERROR]', e)
            reply('❌ Erreur lors de la purge groupée.')
        }
    }
}
