/**
 * ╔══════════════════════════════════════╗
 *  ELY BOT — Module de Gestion des Groupes
 *  Modération avancée des groupes WhatsApp
 * ╚══════════════════════════════════════╝
 *
 * Commandes disponibles :
 *  .grp            — Affiche ce menu avec l'état actuel du groupe
 *  .antilink       — Active/désactive la suppression automatique des liens
 *  .setrules       — Définit les règles du groupe (depuis WhatsApp)
 *  .rules          — Affiche les règles du groupe
 *  .warn           — Avertit un membre (expulsion auto si seuil atteint)
 *  .warnings       — Affiche les avertissements en cours
 *  .resetwarn      — Remet les avertissements d'un membre à zéro
 *  .setwarnlimit   — Définit le seuil d'expulsion automatique
 *  .open           — Ouvre le groupe (tout le monde peut écrire)
 *  .close          — Ferme le groupe (admins seulement)
 *  .autoopen       — Programme l'ouverture automatique (format HH:MM)
 *  .autoclose      — Programme la fermeture automatique (format HH:MM)
 */

module.exports = {
    name: 'grp',
    category: 'admin',
    desc: 'Menu de gestion avancée des groupes WhatsApp.',
    // Tous les alias gérés par ce fichier
    commands: [
        'grp',
        'antilink',
        'setrules', 'rules',
        'warn', 'warnings', 'resetwarn', 'setwarnlimit',
        'open', 'close',
        'autoopen', 'autoclose'
    ],
    run: async (sock, m, args, { reply, isAdmins, isBotAdmins, isGroup, isOwner }) => {
        const from = m.key.remoteJid
        const expediteur = m.sender
        const idExpediteur = expediteur.split('@')[0]

        // Extraction de la commande depuis le texte brut
        const commande = m.text.slice(1).trim().split(/ +/).shift().toLowerCase()
        const texte = args.join(' ').trim()

        // ── Récupération (ou initialisation) des données du groupe ──
        const obtenirDonneesGroupe = () => {
            if (global.getGroupDB) return global.getGroupDB(from)
            // Fallback si getGroupDB n'est pas disponible
            if (!global.db.groups) global.db.groups = {}
            if (!global.db.groups[from]) {
                global.db.groups[from] = {
                    antilink: false,
                    rules: [],
                    warnLimit: 3,
                    warnings: {},
                    autoclose: null,
                    autoopen: null
                }
            }
            return global.db.groups[from]
        }

        // JID du propriétaire du bot (pour les notifications)
        const jidProprietaire = global.owner[0].endsWith('@s.whatsapp.net')
            ? global.owner[0] : global.owner[0] + '@s.whatsapp.net'

        // ════════════════════════════════════════════════════════
        // .grp — Affichage du menu principal avec état actuel
        // ════════════════════════════════════════════════════════
        if (commande === 'grp') {
            if (!isGroup) return reply('❌ Cette commande est réservée aux groupes.')
            const donnees = obtenirDonneesGroupe()

            const statutAntiLien = donnees.antilink ? '🟢 Activé' : '🔴 Désactivé'
            const nbRegles = donnees.rules.length
            const seuilAvert = donnees.warnLimit || 3
            const heureOuverture = donnees.autoopen || 'Non configuré'
            const heureFermeture = donnees.autoclose || 'Non configuré'

            const menu = `╔══════════════════════╗
  🛡️ *GESTION DE GROUPE*
╚══════════════════════╝

📊 *État actuel :*
  🔗 Anti-lien : ${statutAntiLien}
  📜 Règles : ${nbRegles} règle(s) définie(s)
  ⚠️ Seuil d'expulsion : ${seuilAvert} avertissements
  ⏰ Fermeture auto : ${heureFermeture}
  ⏰ Ouverture auto : ${heureOuverture}

📋 *Commandes disponibles :*

🔗 *Anti-Lien*
  *.antilink on/off* — Bloquer les liens

📜 *Règles*
  *.setrules <règle1|règle2|...>* — Définir les règles
  *.rules* — Afficher les règles

⚠️ *Avertissements*
  *.warn @membre* — Avertir un membre
  *.warnings @membre* — Voir ses avertissements
  *.resetwarn @membre* — Remettre à zéro
  *.setwarnlimit <N>* — Seuil avant expulsion

🔒 *Contrôle d'accès*
  *.open* — Ouvrir le groupe
  *.close* — Fermer le groupe
  *.autoopen HH:MM* — Ouverture automatique quotidienne
  *.autoclose HH:MM* — Fermeture automatique quotidienne

━━━━━━━━━━━━━━━━━━━━━━
_Commandes réservées aux administrateurs._`

            return reply(menu)
        }

        // ── Garde : groupe et droits admin requis pour toutes les autres commandes ──
        if (!isGroup) return reply('❌ Cette commande est réservée aux groupes.')
        if (!isAdmins) return reply('❌ Vous devez être administrateur pour utiliser cette commande.')

        const donnees = obtenirDonneesGroupe()

        // ════════════════════════════════════════════════════════
        // .antilink on/off — Activer/désactiver la protection anti-lien
        // ════════════════════════════════════════════════════════
        if (commande === 'antilink') {
            const action = args[0]?.toLowerCase()
            if (action === 'on') {
                donnees.antilink = true
                return reply('✅ *Anti-lien activé !*\nTous les liens envoyés par des non-admins seront automatiquement supprimés.')
            } else if (action === 'off') {
                donnees.antilink = false
                return reply('✅ *Anti-lien désactivé.*\nLes membres peuvent maintenant partager des liens.')
            } else {
                // Afficher l'état actuel si aucun argument
                const statut = donnees.antilink ? '🟢 Activé' : '🔴 Désactivé'
                return reply(`🔗 *Anti-lien* : ${statut}\n\n_Utilisez_ *.antilink on* _ou_ *.antilink off*`)
            }
        }

        // ════════════════════════════════════════════════════════
        // .setrules <règle1|règle2|...> — Définir les règles du groupe
        // Les règles sont séparées par un pipe "|"
        // ════════════════════════════════════════════════════════
        if (commande === 'setrules') {
            if (!texte) return reply(
                '❌ Veuillez fournir les règles du groupe.\n\n' +
                '*Exemple :*\n`.setrules Pas de spam|Respecter tout le monde|Pas de liens`\n\n' +
                '_Séparez chaque règle par un pipe `|`_'
            )

            const regles = texte.split('|').map(r => r.trim()).filter(r => r.length > 0)
            if (regles.length === 0) return reply('❌ Aucune règle valide détectée.')

            donnees.rules = regles

            // Confirmation avec affichage des règles enregistrées
            let confirmation = `✅ *${regles.length} règle(s) enregistrée(s) !*\n\n📜 *Règles du groupe :*\n`
            regles.forEach((regle, i) => { confirmation += `\n${i + 1}. ${regle}` })
            return reply(confirmation)
        }

        // ════════════════════════════════════════════════════════
        // .rules — Afficher les règles du groupe
        // ════════════════════════════════════════════════════════
        if (commande === 'rules') {
            if (!donnees.rules || donnees.rules.length === 0) {
                return reply(
                    '📜 *Aucune règle définie pour ce groupe.*\n\n' +
                    '_Utilisez_ `.setrules Règle1|Règle2|...` _pour définir les règles._'
                )
            }

            let texteRegles = `📜 *RÈGLES DU GROUPE*\n${'─'.repeat(25)}\n`
            donnees.rules.forEach((regle, i) => {
                texteRegles += `\n${i + 1}. ${regle}`
            })
            texteRegles += `\n\n${'─'.repeat(25)}\n_Le non-respect de ces règles entraîne des sanctions._`
            return reply(texteRegles)
        }

        // ════════════════════════════════════════════════════════
        // .warn @membre — Avertir un utilisateur
        // Expulsion automatique si le seuil est atteint
        // ════════════════════════════════════════════════════════
        if (commande === 'warn') {
            if (!isBotAdmins) return reply('❌ Je dois être administrateur pour avertir des membres.')

            // Identifier la cible (mention ou réponse à un message)
            const cible = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
            if (!cible) return reply('❌ Mentionnez un utilisateur ou répondez à son message.')

            const idCible = cible.split('@')[0]

            // Interdire d'avertir un administrateur du groupe
            try {
                const meta = await sock.groupMetadata(from).catch(() => null)
                if (meta) {
                    const admins = meta.participants.filter(p => p.admin !== null).map(p => sock.decodeJid(p.id))
                    if (admins.includes(sock.decodeJid(cible))) {
                        return reply('❌ Vous ne pouvez pas avertir un administrateur du groupe.')
                    }
                }
            } catch (e) { /* Continuer si erreur */ }

            // Interdire d'avertir le propriétaire du bot
            if (global.owner.includes(idCible)) {
                return reply('❌ Vous ne pouvez pas avertir le propriétaire du bot.')
            }

            // Incrémenter le compteur d'avertissements
            if (!donnees.warnings) donnees.warnings = {}
            donnees.warnings[idCible] = (donnees.warnings[idCible] || 0) + 1
            const nbAvert = donnees.warnings[idCible]
            const seuilExpulsion = donnees.warnLimit || 3

            let messageAvert = `⚠️ *AVERTISSEMENT* ⚠️\n\n`
            messageAvert += `👤 @${idCible}\n`
            messageAvert += `📊 Avertissements : *${nbAvert}/${seuilExpulsion}*\n\n`

            // Afficher les règles comme rappel si elles existent
            if (donnees.rules?.length > 0) {
                messageAvert += `📜 *Rappel des règles :*\n`
                donnees.rules.forEach((regle, i) => { messageAvert += `${i + 1}. ${regle}\n` })
                messageAvert += '\n'
            }

            if (nbAvert >= seuilExpulsion) {
                // Seuil atteint : expulsion automatique
                messageAvert += `🚨 *Seuil atteint ! Expulsion en cours...*`
                await sock.sendMessage(from, { text: messageAvert, mentions: [cible] })
                try {
                    await sock.groupParticipantsUpdate(from, [cible], 'remove')
                    await sock.sendMessage(from, {
                        text: `✅ @${idCible} a été expulsé après *${nbAvert} avertissements*.`,
                        mentions: [cible]
                    })
                    donnees.warnings[idCible] = 0 // Remise à zéro après expulsion
                } catch (e) {
                    await sock.sendMessage(from, {
                        text: `❌ Impossible d'expulser @${idCible} : ${e.message}`,
                        mentions: [cible]
                    })
                }
            } else {
                // Avertissement simple avec nombre restant avant expulsion
                messageAvert += `⚡ Encore *${seuilExpulsion - nbAvert}* avertissement(s) avant l'expulsion.`
                await sock.sendMessage(from, { text: messageAvert, mentions: [cible] })
            }
            return
        }

        // ════════════════════════════════════════════════════════
        // .warnings — Afficher le tableau des avertissements
        // ════════════════════════════════════════════════════════
        if (commande === 'warnings') {
            const cible = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)

            if (!cible) {
                // Afficher tous les avertissements du groupe
                const tousAvert = donnees.warnings || {}
                const entrees = Object.entries(tousAvert).filter(([, nb]) => nb > 0)
                if (entrees.length === 0) return reply('✅ Aucun avertissement actif dans ce groupe.')

                let tableau = `📊 *TABLEAU DES AVERTISSEMENTS*\n${'─'.repeat(25)}\n`
                entrees.forEach(([uid, nb]) => {
                    tableau += `👤 @${uid} : *${nb}/${donnees.warnLimit || 3}* ⚠️\n`
                })
                const mentions = entrees.map(([uid]) => uid + '@s.whatsapp.net')
                return sock.sendMessage(from, { text: tableau, mentions }, { quoted: m })
            }

            // Afficher les avertissements d'un membre spécifique
            const idCible = cible.split('@')[0]
            const nb = (donnees.warnings || {})[idCible] || 0
            return reply(`📊 *Avertissements de @${idCible}* : ${nb}/${donnees.warnLimit || 3} ⚠️`, { mentions: [cible] })
        }

        // ════════════════════════════════════════════════════════
        // .resetwarn @membre — Remettre les avertissements à zéro
        // ════════════════════════════════════════════════════════
        if (commande === 'resetwarn') {
            const cible = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
            if (!cible) return reply('❌ Mentionnez un utilisateur ou répondez à son message.')

            const idCible = cible.split('@')[0]
            if (!donnees.warnings) donnees.warnings = {}
            donnees.warnings[idCible] = 0
            return reply(`✅ Les avertissements de @${idCible} ont été remis à zéro.`, { mentions: [cible] })
        }

        // ════════════════════════════════════════════════════════
        // .setwarnlimit <N> — Définir le seuil d'expulsion automatique
        // ════════════════════════════════════════════════════════
        if (commande === 'setwarnlimit') {
            const seuil = parseInt(args[0])
            if (isNaN(seuil) || seuil < 1 || seuil > 20) {
                return reply('❌ Le seuil doit être un nombre entre 1 et 20.\n_Exemple :_ `.setwarnlimit 3`')
            }
            donnees.warnLimit = seuil
            return reply(`✅ Seuil d'expulsion automatique défini à *${seuil} avertissement(s)*.`)
        }

        // ════════════════════════════════════════════════════════
        // .open — Ouvrir le groupe (tout le monde peut écrire)
        // ════════════════════════════════════════════════════════
        if (commande === 'open') {
            if (!isBotAdmins) return reply('❌ Je dois être administrateur pour modifier les paramètres du groupe.')
            try {
                await sock.groupSettingUpdate(from, 'not_announcement')
                return reply('🔓 *Groupe ouvert !*\nTout le monde peut maintenant envoyer des messages.')
            } catch (e) {
                return reply(`❌ Erreur lors de l'ouverture du groupe : ${e.message}`)
            }
        }

        // ════════════════════════════════════════════════════════
        // .close — Fermer le groupe (admins seulement)
        // ════════════════════════════════════════════════════════
        if (commande === 'close') {
            if (!isBotAdmins) return reply('❌ Je dois être administrateur pour modifier les paramètres du groupe.')
            try {
                await sock.groupSettingUpdate(from, 'announcement')
                return reply('🔒 *Groupe fermé !*\nSeuls les administrateurs peuvent maintenant envoyer des messages.')
            } catch (e) {
                return reply(`❌ Erreur lors de la fermeture du groupe : ${e.message}`)
            }
        }

        // ════════════════════════════════════════════════════════
        // .autoclose HH:MM — Programmer la fermeture automatique quotidienne
        // ════════════════════════════════════════════════════════
        if (commande === 'autoclose') {
            if (!isBotAdmins) return reply('❌ Je dois être administrateur pour programmer la fermeture.')

            if (!texte) {
                // Afficher l'état actuel si aucun argument
                if (donnees.autoclose) {
                    return reply(`⏰ Fermeture automatique programmée à *${donnees.autoclose}*.\n\n_Utilisez_ \`.autoclose off\` _pour désactiver._`)
                }
                return reply('❌ Indiquez une heure au format HH:MM.\n_Exemple :_ `.autoclose 22:00`')
            }

            if (texte.toLowerCase() === 'off') {
                donnees.autoclose = null
                return reply('✅ Fermeture automatique désactivée.')
            }

            // Valider le format de l'heure (HH:MM)
            if (!/^\d{2}:\d{2}$/.test(texte)) {
                return reply('❌ Format invalide. Utilisez HH:MM (ex: `22:00`)')
            }

            donnees.autoclose = texte
            return reply(`✅ *Fermeture automatique programmée à ${texte}.*\nLe groupe sera fermé automatiquement chaque jour à cette heure.`)
        }

        // ════════════════════════════════════════════════════════
        // .autoopen HH:MM — Programmer l'ouverture automatique quotidienne
        // ════════════════════════════════════════════════════════
        if (commande === 'autoopen') {
            if (!isBotAdmins) return reply('❌ Je dois être administrateur pour programmer l\'ouverture.')

            if (!texte) {
                // Afficher l'état actuel si aucun argument
                if (donnees.autoopen) {
                    return reply(`⏰ Ouverture automatique programmée à *${donnees.autoopen}*.\n\n_Utilisez_ \`.autoopen off\` _pour désactiver._`)
                }
                return reply('❌ Indiquez une heure au format HH:MM.\n_Exemple :_ `.autoopen 07:00`')
            }

            if (texte.toLowerCase() === 'off') {
                donnees.autoopen = null
                return reply('✅ Ouverture automatique désactivée.')
            }

            // Valider le format de l'heure (HH:MM)
            if (!/^\d{2}:\d{2}$/.test(texte)) {
                return reply('❌ Format invalide. Utilisez HH:MM (ex: `07:00`)')
            }

            donnees.autoopen = texte
            return reply(`✅ *Ouverture automatique programmée à ${texte}.*\nLe groupe sera ouvert automatiquement chaque jour à cette heure.`)
        }
    }
}
