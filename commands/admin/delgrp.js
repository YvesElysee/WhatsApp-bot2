module.exports = {
    name: 'delgrp',
    category: 'admin',
    desc: 'Supprime vos messages dans un groupe (par nom, numéro ou JID) ou dans une conversation.',
    commands: ['delgrp', 'purge', 'cleanme', 'delmsg'],
    run: async (sock, m, args, { reply, isOwner }) => {
        if (!isOwner) return reply('❌ Seul le propriétaire peut utiliser cette commande.')

        // ─────────────────────────────────────────────────────────
        // USAGE:
        //   .delgrp 5                    → supprimer 5 msgs dans le chat actuel
        //   .delgrp NomDuGroupe 5        → supprimer 5 msgs dans le groupe par nom
        //   .delgrp 237612345678 5       → supprimer 5 msgs dans la conv de ce numéro
        //   .delgrp 120363xxxxx@g.us 5   → supprimer 5 msgs via JID complet
        // ─────────────────────────────────────────────────────────

        let targetJid = m.key.remoteJid
        let count = 0
        let nomRecherche = ''

        if (args.length === 0) {
            return reply(
                '❌ *Usage :*\n\n' +
                '• `.delgrp 5` — Supprimer 5 de vos messages ici\n' +
                '• `.delgrp NomGroupe 5` — Supprimer dans un groupe par nom\n' +
                '• `.delgrp 237612345678 5` — Supprimer dans une conversation\n' +
                '• `.delgrp 120363xxx@g.us 5` — Supprimer via JID complet\n\n' +
                '⚠️ Limite : 50 messages par purge.'
            )
        }

        if (args.length === 1) {
            // Seul un chiffre → supprimer dans le chat actuel
            count = parseInt(args[0])
            if (isNaN(count)) {
                return reply('❌ Argument invalide. Utilisez : `.delgrp 5`')
            }
        } else {
            // Premier arg = cible, deuxième = nombre
            const premierArg = args[0]
            count = parseInt(args[args.length - 1])
            if (isNaN(count)) {
                return reply('❌ Le dernier argument doit être le nombre de messages.\nEx: `.delgrp NomGroupe 5`')
            }

            // Reconstituer le nom (peut contenir des espaces) en excluant le dernier arg (nombre)
            nomRecherche = args.slice(0, -1).join(' ').trim()

            // CAS 1 : JID complet fourni
            if (nomRecherche.includes('@')) {
                targetJid = nomRecherche
            }
            // CAS 2 : Numéro de téléphone (que des chiffres)
            else if (/^\d+$/.test(nomRecherche)) {
                const num = nomRecherche.replace(/\D/g, '')
                targetJid = num + '@s.whatsapp.net'
            }
            // CAS 3 : Nom du groupe (recherche dans le cache)
            else {
                const groupsCache = global.db.groupsCache || {}
                const nomLower = nomRecherche.toLowerCase()
                let trouve = null
                let scoreMax = 0

                for (const [jid, grp] of Object.entries(groupsCache)) {
                    const sujetLower = (grp.subject || '').toLowerCase()
                    // Correspondance exacte en priorité, sinon inclus
                    if (sujetLower === nomLower) {
                        trouve = jid
                        break
                    }
                    if (sujetLower.includes(nomLower) || nomLower.includes(sujetLower)) {
                        const score = sujetLower.includes(nomLower) ? nomLower.length : sujetLower.length
                        if (score > scoreMax) {
                            scoreMax = score
                            trouve = jid
                        }
                    }
                }

                if (!trouve) {
                    // Lister les groupes disponibles pour aider
                    const listeGroupes = Object.values(groupsCache)
                        .map(g => `• ${g.subject}`)
                        .slice(0, 10)
                        .join('\n')

                    return reply(
                        `❌ Groupe "*${nomRecherche}*" introuvable.\n\n` +
                        `📋 *Groupes disponibles :*\n${listeGroupes || 'Aucun groupe en cache.'}\n\n` +
                        `_Tapez exactement le nom du groupe ou utilisez son JID._`
                    )
                }
                targetJid = trouve
                const nomTrouve = groupsCache[trouve]?.subject || trouve
                reply(`🔍 Groupe trouvé : *${nomTrouve}*\nPréparation de la purge...`)
            }
        }

        if (isNaN(count) || count <= 0) return reply('❌ Nombre invalide.')
        if (count > 50) return reply('⚠️ Par sécurité, la limite est de 50 messages par purge.')

        // Afficher ce qu'on va faire
        const nomCible = targetJid.includes('@g.us')
            ? (global.db.groupsCache?.[targetJid]?.subject || targetJid.split('@')[0])
            : targetJid.split('@')[0]

        reply(`⚙️ Recherche de *${count}* de vos messages dans *${nomCible}*...`)

        try {
            // Filtrer les messages du propriétaire dans ce chat
            const messages = Array.from(global.db.msgStore.values())
                .filter(item => item.from === targetJid && item.sender === m.sender)
                .reverse()
                .slice(0, count)

            if (messages.length === 0) {
                return reply(
                    `❌ Aucun message récent trouvé dans *${nomCible}*.\n\n` +
                    `_Les messages doivent avoir été envoyés depuis le démarrage du bot (mémorisés en cache)._`
                )
            }

            reply(`⚙️ Suppression de *${messages.length}* messages dans *${nomCible}*...`)

            let deleted = 0
            let errors = 0
            for (const msgItem of messages) {
                try {
                    await sock.sendMessage(targetJid, { delete: msgItem.m.key })
                    deleted++
                    await new Promise(res => setTimeout(res, 400)) // délai anti-ban
                } catch (err) {
                    errors++
                    console.error('[PURGE] Échec suppression:', err.message)
                }
            }

            // Rapport envoyé au propriétaire en inbox
            const ownerJid = global.owner[0]?.endsWith('@s.whatsapp.net')
                ? global.owner[0] : global.owner[0] + '@s.whatsapp.net'

            const rapport = `✅ *PURGE TERMINÉE*\n` +
                `📍 Cible : *${nomCible}*\n` +
                `🗑️ Supprimés : *${deleted}*\n` +
                (errors > 0 ? `⚠️ Erreurs : *${errors}*\n` : '') +
                `\n_Rapport envoyé dans votre inbox._`

            await sock.sendMessage(ownerJid, { text: rapport })
            reply('✅ Action terminée. Détails dans votre inbox.')

        } catch (e) {
            console.error('[PURGE ERROR]', e)
            reply('❌ Erreur lors de la purge groupée.')
        }
    }
}
