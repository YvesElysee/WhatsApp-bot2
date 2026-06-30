/**
 * ╔══════════════════════════════════════╗
 *  ELY BOT — Group Manager Module
 *  Gestion avancée des groupes WhatsApp
 * ╚══════════════════════════════════════╝
 *
 * Commandes disponibles :
 *  .grp            — Affiche ce menu
 *  .antilink       — Active/désactive la suppression automatique des liens
 *  .setrules       — Définit les règles du groupe
 *  .rules          — Affiche les règles
 *  .warn           — Avertit un utilisateur
 *  .warnings       — Affiche le compteur d'avertissements
 *  .resetwarn      — Remet les avertissements à zéro
 *  .setwarnlimit   — Définit le seuil d'expulsion automatique
 *  .open           — Ouvre le groupe (tout le monde peut écrire)
 *  .close          — Ferme le groupe (admins seulement)
 *  .autoopen       — Programme l'ouverture automatique (HH:MM)
 *  .autoclose      — Programme la fermeture automatique (HH:MM)
 */

module.exports = {
    name: 'grp',
    category: 'admin',
    desc: 'Menu de gestion avancée des groupes.',
    commands: [
        'grp',
        'antilink',
        'setrules', 'rules',
        'warn', 'warnings', 'resetwarn', 'setwarnlimit',
        'open', 'close',
        'autoopen', 'autoclose'
    ],
    run: async (sock, m, args, { reply, isAdmins, isBotAdmins, isGroup, isOwner, getGroupDB }) => {
        const from = m.key.remoteJid
        const sender = m.sender
        const senderId = sender.split('@')[0]
        const command = m.text.slice(1).trim().split(/ +/).shift().toLowerCase()
        const text = args.join(' ').trim()

        // ── Helpers ──────────────────────────────────────────────
        const getGrp = () => {
            if (global.getGroupDB) return global.getGroupDB(from)
            // Fallback if getGroupDB not available
            if (!global.db.groups) global.db.groups = {}
            if (!global.db.groups[from]) {
                global.db.groups[from] = {
                    antilink: false, rules: [], warnLimit: 3,
                    warnings: {}, autoclose: null, autoopen: null
                }
            }
            return global.db.groups[from]
        }

        const ownerJid = global.owner[0].endsWith('@s.whatsapp.net')
            ? global.owner[0]
            : global.owner[0] + '@s.whatsapp.net'

        // ── .grp — Menu ───────────────────────────────────────────
        if (command === 'grp') {
            if (!isGroup) return reply('❌ Cette commande est réservée aux groupes.')
            const grpData = getGrp()

            const antiStatus = grpData.antilink ? '🟢 Activé' : '🔴 Désactivé'
            const rulesCount = grpData.rules.length
            const warnLimit = grpData.warnLimit || 3
            const autoClose = grpData.autoclose || 'Non configuré'
            const autoOpen = grpData.autoopen || 'Non configuré'

            const menu = `╔══════════════════════╗
  🛡️ *GESTION DE GROUPE*
╚══════════════════════╝

📊 *État actuel :*
  🔗 Anti-lien : ${antiStatus}
  📜 Règles : ${rulesCount} règle(s) définie(s)
  ⚠️ Seuil d'expulsion : ${warnLimit} avertissements
  ⏰ Fermeture auto : ${autoClose}
  ⏰ Ouverture auto : ${autoOpen}

📋 *Commandes disponibles :*

🔗 *Anti-Lien*
  *.antilink on/off* — Bloquer les liens

📜 *Règles*
  *.setrules <règle1|règle2|...>* — Définir les règles
  *.rules* — Voir les règles

⚠️ *Avertissements*
  *.warn @user* — Avertir un membre
  *.warnings @user* — Voir ses avertissements
  *.resetwarn @user* — Réinitialiser ses avertissements
  *.setwarnlimit <N>* — Seuil avant expulsion

🔒 *Contrôle d'accès*
  *.open* — Ouvrir le groupe
  *.close* — Fermer le groupe
  *.autoopen HH:MM* — Ouverture automatique
  *.autoclose HH:MM* — Fermeture automatique

━━━━━━━━━━━━━━━━━━━━━━
_Commandes réservées aux admins._`

            return reply(menu)
        }

        // ── Guard: Groupe requis ──────────────────────────────────
        if (!isGroup) return reply('❌ Cette commande est réservée aux groupes.')
        if (!isAdmins) return reply('❌ Vous devez être administrateur pour utiliser cette commande.')

        const grpData = getGrp()

        // ════════════════════════════════════════════════════════
        // .antilink on/off
        // ════════════════════════════════════════════════════════
        if (command === 'antilink') {
            const action = args[0]?.toLowerCase()
            if (action === 'on') {
                grpData.antilink = true
                return reply('✅ *Anti-lien activé !*\nTous les liens envoyés par des non-admins seront automatiquement supprimés.')
            } else if (action === 'off') {
                grpData.antilink = false
                return reply('✅ *Anti-lien désactivé.*\nLes membres peuvent maintenant partager des liens.')
            } else {
                const status = grpData.antilink ? '🟢 Activé' : '🔴 Désactivé'
                return reply(`🔗 *Anti-lien* : ${status}\n\n_Utilisez_ *.antilink on* _ou_ *.antilink off* _pour changer l'état._`)
            }
        }

        // ════════════════════════════════════════════════════════
        // .setrules <règle1|règle2|...>
        // ════════════════════════════════════════════════════════
        if (command === 'setrules') {
            if (!text) return reply(
                '❌ Veuillez fournir les règles du groupe.\n\n' +
                '*Exemple :*\n`.setrules Pas de spam|Respecter tout le monde|Pas de liens non autorisés`\n\n' +
                '_Séparez chaque règle par un pipe `|`_'
            )

            const rules = text.split('|').map(r => r.trim()).filter(r => r.length > 0)
            if (rules.length === 0) return reply('❌ Aucune règle valide détectée.')

            grpData.rules = rules
            let rulesText = `✅ *${rules.length} règle(s) enregistrée(s) !*\n\n📜 *Règles du groupe :*\n`
            rules.forEach((rule, i) => { rulesText += `\n${i + 1}. ${rule}` })
            return reply(rulesText)
        }

        // ════════════════════════════════════════════════════════
        // .rules — Afficher les règles
        // ════════════════════════════════════════════════════════
        if (command === 'rules') {
            if (!grpData.rules || grpData.rules.length === 0) {
                return reply(
                    '📜 *Aucune règle définie pour ce groupe.*\n\n' +
                    '_Utilisez_ `.setrules Règle1|Règle2|...` _pour définir les règles._'
                )
            }

            let rulesText = `📜 *RÈGLES DU GROUPE*\n${'─'.repeat(25)}\n`
            grpData.rules.forEach((rule, i) => {
                rulesText += `\n${i + 1}. ${rule}`
            })
            rulesText += `\n\n${'─'.repeat(25)}\n_Respectez ces règles sous peine de sanctions._`
            return reply(rulesText)
        }

        // ════════════════════════════════════════════════════════
        // .warn @user — Avertir un utilisateur
        // ════════════════════════════════════════════════════════
        if (command === 'warn') {
            if (!isBotAdmins) return reply('❌ Je dois être administrateur pour avertir des membres.')
            const target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
            if (!target) return reply('❌ Mentionnez un utilisateur ou répondez à son message.')

            const targetId = target.split('@')[0]

            // Don't warn owner or admins
            try {
                const meta = await sock.groupMetadata(from).catch(() => null)
                if (meta) {
                    const admins = meta.participants.filter(p => p.admin !== null).map(p => sock.decodeJid(p.id))
                    const decodedTarget = sock.decodeJid(target)
                    if (admins.includes(decodedTarget)) {
                        return reply(`❌ Vous ne pouvez pas avertir un administrateur.`)
                    }
                }
            } catch (e) { }

            if (global.owner.includes(targetId)) return reply('❌ Vous ne pouvez pas avertir le propriétaire du bot.')

            if (!grpData.warnings) grpData.warnings = {}
            grpData.warnings[targetId] = (grpData.warnings[targetId] || 0) + 1
            const warnCount = grpData.warnings[targetId]
            const warnLimit = grpData.warnLimit || 3

            let warnText = `⚠️ *AVERTISSEMENT* ⚠️\n\n`
            warnText += `👤 @${targetId}\n`
            warnText += `📊 Avertissements : *${warnCount}/${warnLimit}*\n\n`

            // Show rules if any
            if (grpData.rules && grpData.rules.length > 0) {
                warnText += `📜 *Rappel des règles :*\n`
                grpData.rules.forEach((rule, i) => { warnText += `${i + 1}. ${rule}\n` })
                warnText += '\n'
            }

            if (warnCount >= warnLimit) {
                warnText += `🚨 *Seuil atteint ! Expulsion en cours...*`
                await sock.sendMessage(from, { text: warnText, mentions: [target] })
                try {
                    await sock.groupParticipantsUpdate(from, [target], 'remove')
                    await sock.sendMessage(from, {
                        text: `✅ @${targetId} a été expulsé après *${warnCount} avertissements*.`,
                        mentions: [target]
                    })
                    // Reset warnings after kick
                    grpData.warnings[targetId] = 0
                } catch (e) {
                    await sock.sendMessage(from, { text: `❌ Impossible d'expulser @${targetId} : ${e.message}`, mentions: [target] })
                }
            } else {
                warnText += `⚡ Encore *${warnLimit - warnCount}* avertissement(s) avant l'expulsion.`
                await sock.sendMessage(from, { text: warnText, mentions: [target] })
            }
            return
        }

        // ════════════════════════════════════════════════════════
        // .warnings @user — Voir les avertissements
        // ════════════════════════════════════════════════════════
        if (command === 'warnings') {
            const target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
            if (!target) {
                // Show all warnings
                const warnings = grpData.warnings || {}
                const entries = Object.entries(warnings).filter(([, count]) => count > 0)
                if (entries.length === 0) return reply('✅ Aucun avertissement actif dans ce groupe.')

                let text2 = `📊 *LISTE DES AVERTISSEMENTS*\n${'─'.repeat(25)}\n`
                entries.forEach(([uid, count]) => {
                    text2 += `👤 @${uid} : *${count}/${grpData.warnLimit || 3}* ⚠️\n`
                })
                const mentions = entries.map(([uid]) => uid + '@s.whatsapp.net')
                return sock.sendMessage(from, { text: text2, mentions }, { quoted: m })
            }

            const targetId = target.split('@')[0]
            const count = (grpData.warnings || {})[targetId] || 0
            const warnLimit = grpData.warnLimit || 3
            return reply(`📊 *Avertissements de @${targetId}* :\n${count}/${warnLimit} ⚠️`, { mentions: [target] })
        }

        // ════════════════════════════════════════════════════════
        // .resetwarn @user — Réinitialiser les avertissements
        // ════════════════════════════════════════════════════════
        if (command === 'resetwarn') {
            const target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
            if (!target) return reply('❌ Mentionnez un utilisateur ou répondez à son message.')

            const targetId = target.split('@')[0]
            if (!grpData.warnings) grpData.warnings = {}
            grpData.warnings[targetId] = 0
            return reply(`✅ Les avertissements de @${targetId} ont été réinitialisés.`, { mentions: [target] })
        }

        // ════════════════════════════════════════════════════════
        // .setwarnlimit <N> — Définir le seuil d'expulsion
        // ════════════════════════════════════════════════════════
        if (command === 'setwarnlimit') {
            const limit = parseInt(args[0])
            if (isNaN(limit) || limit < 1 || limit > 20) {
                return reply('❌ Le seuil doit être un nombre entre 1 et 20.\n_Exemple :_ `.setwarnlimit 3`')
            }
            grpData.warnLimit = limit
            return reply(`✅ Seuil d'expulsion automatique défini à *${limit} avertissement(s)*.`)
        }

        // ════════════════════════════════════════════════════════
        // .open — Ouvrir le groupe
        // ════════════════════════════════════════════════════════
        if (command === 'open') {
            if (!isBotAdmins) return reply('❌ Je dois être administrateur pour modifier les paramètres du groupe.')
            try {
                await sock.groupSettingUpdate(from, 'not_announcement')
                return reply('🔓 *Groupe ouvert !*\nTout le monde peut maintenant envoyer des messages.')
            } catch (e) {
                return reply(`❌ Erreur : ${e.message}`)
            }
        }

        // ════════════════════════════════════════════════════════
        // .close — Fermer le groupe
        // ════════════════════════════════════════════════════════
        if (command === 'close') {
            if (!isBotAdmins) return reply('❌ Je dois être administrateur pour modifier les paramètres du groupe.')
            try {
                await sock.groupSettingUpdate(from, 'announcement')
                return reply('🔒 *Groupe fermé !*\nSeuls les administrateurs peuvent maintenant envoyer des messages.')
            } catch (e) {
                return reply(`❌ Erreur : ${e.message}`)
            }
        }

        // ════════════════════════════════════════════════════════
        // .autoclose HH:MM — Programmer la fermeture
        // ════════════════════════════════════════════════════════
        if (command === 'autoclose') {
            if (!isBotAdmins) return reply('❌ Je dois être administrateur pour programmer la fermeture.')
            if (!text) {
                if (grpData.autoclose) {
                    return reply(`⏰ Fermeture automatique programmée à *${grpData.autoclose}*.\n\n_Utilisez_ \`.autoclose off\` _pour désactiver._`)
                }
                return reply('❌ Indiquez une heure au format HH:MM.\n_Exemple :_ `.autoclose 22:00`')
            }
            if (text.toLowerCase() === 'off') {
                grpData.autoclose = null
                return reply('✅ Fermeture automatique désactivée.')
            }
            if (!/^\d{2}:\d{2}$/.test(text)) {
                return reply('❌ Format invalide. Utilisez HH:MM (ex: `22:00`)')
            }
            grpData.autoclose = text
            return reply(`✅ *Fermeture automatique programmée à ${text}.*\nLe groupe sera fermé chaque jour à cette heure.`)
        }

        // ════════════════════════════════════════════════════════
        // .autoopen HH:MM — Programmer l'ouverture
        // ════════════════════════════════════════════════════════
        if (command === 'autoopen') {
            if (!isBotAdmins) return reply('❌ Je dois être administrateur pour programmer l\'ouverture.')
            if (!text) {
                if (grpData.autoopen) {
                    return reply(`⏰ Ouverture automatique programmée à *${grpData.autoopen}*.\n\n_Utilisez_ \`.autoopen off\` _pour désactiver._`)
                }
                return reply('❌ Indiquez une heure au format HH:MM.\n_Exemple :_ `.autoopen 07:00`')
            }
            if (text.toLowerCase() === 'off') {
                grpData.autoopen = null
                return reply('✅ Ouverture automatique désactivée.')
            }
            if (!/^\d{2}:\d{2}$/.test(text)) {
                return reply('❌ Format invalide. Utilisez HH:MM (ex: `07:00`)')
            }
            grpData.autoopen = text
            return reply(`✅ *Ouverture automatique programmée à ${text}.*\nLe groupe sera ouvert chaque jour à cette heure.`)
        }
    }
}
