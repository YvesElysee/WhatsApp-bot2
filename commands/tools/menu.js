module.exports = {
    name: 'menu',
    category: 'tools',
    desc: 'Affiche le menu principal du bot.',
    commands: ['menu', 'help', 'start'],
    run: async (sock, m, args, { reply, isOwner, isAdmins, isGroup }) => {
        const pushname = m.pushName || 'Cher utilisateur'
        const creatorName = global.author || 'Ely'
        const creatorNumber = global.owner[0] || '237697353272'
        const now = new Date()
        const hour = now.getHours()
        const greeting = hour < 12 ? '🌅 Bonjour' : hour < 18 ? '☀️ Bon après-midi' : '🌙 Bonsoir'

        let menu = ''

        // ── Header ─────────────────────────────────────────────
        menu += `╔══════════════════════════╗\n`
        menu += `║   🤖 *ELY BOT v2.0* 🤖   ║\n`
        menu += `╚══════════════════════════╝\n\n`

        menu += `${greeting}, *${pushname}* ! 👋\n`
        menu += `_Votre assistant WhatsApp intelligent_\n\n`

        // ── AI Section ─────────────────────────────────────────
        menu += `╭─────〔 🧠 *INTELLIGENCE ARTIFICIELLE* 〕\n`
        menu += `┆ 🦙 *.meta* / *.llama* — Meta AI (Llama-3)\n`
        menu += `┆ ✨ *.ai* / *.ely* — IA automatique\n`
        menu += `┆ 🌍 *.translate* — Traducteur multilingue\n`
        menu += `┆ 🎙️ *.stt* — Audio → Texte\n`
        menu += `╰──────────────────────────\n\n`

        // ── Media Section ──────────────────────────────────────
        menu += `╭─────〔 🎵 *MÉDIAS & TÉLÉCHARGEMENT* 〕\n`
        menu += `┆ 🎵 *.play* / *.mp3* — Télécharger de la musique\n`
        menu += `┆ 🎞️ *.vlt* — Télécharger une vidéo\n`
        menu += `┆ 😄 *.sticker* — Créer un sticker\n`
        menu += `┆ 🖼️ *.toimg* — Sticker → Image\n`
        menu += `┆ 📤 *.extract* — Extraire média d'un sticker\n`
        menu += `┆ 🗣️ *.tts* — Texte vers voix\n`
        menu += `╰──────────────────────────\n\n`

        // ── Tools Section ──────────────────────────────────────
        menu += `╭─────〔 🛠️ *OUTILS UTILES* 〕\n`
        menu += `┆ 📍 *.maps* — Recherche de lieu\n`
        menu += `┆ 💻 *.compile* — Compiler du code\n`
        menu += `┆ 📷 *.capture* — Capture d'écran\n`
        menu += `┆ 🏓 *.ping* — Latence du bot\n`
        menu += `┆ ℹ️ *.info* — Infos sur un utilisateur\n`
        menu += `┆ 📜 *.list* — Catalogue de commandes\n`
        menu += `┆ ℹ️ *.about* — À propos du bot\n`
        menu += `╰──────────────────────────\n\n`

        // ── Games Section ──────────────────────────────────────
        menu += `╭─────〔 🎮 *JEUX & DIVERTISSEMENT* 〕\n`
        menu += `┆ 🎯 *.devine* — Devinez le nombre\n`
        menu += `┆ 🃏 *.guess* — Devinette\n`
        menu += `┆ ❌⭕ *.morpion* — Tic-Tac-Toe\n`
        menu += `┆ 🟡 *.puissance4* — Puissance 4\n`
        menu += `┆ 🔤 *.pendu* — Le Pendu\n`
        menu += `┆ 🧠 *.quiz* — Quiz de culture générale\n`
        menu += `┆ 🛑 *.stopgame* — Arrêter le jeu en cours\n`
        menu += `╰──────────────────────────\n\n`

        // ── Settings Section ───────────────────────────────────
        menu += `╭─────〔 ⚙️ *PARAMÈTRES DU BOT* 〕\n`
        menu += `┆ 🤖 *.chatbot* — Mode chatbot (mention)\n`
        menu += `┆ 👁️ *.statusview* — Vue auto des statuts\n`
        menu += `┆ ❤️ *.statuslike* — Like auto des statuts\n`
        menu += `┆ 🔄 *.autoreact* — Réaction auto\n`
        menu += `┆ 🛡️ *.antidelete* — Anti-suppression\n`
        menu += `┆ 🤖 *.bot* — Activer/désactiver le bot\n`
        menu += `┆ 🔒 *.mode* — Mode privé\n`
        menu += `╰──────────────────────────\n\n`

        // ── Admin & Group (visible to admins/owner in groups) ──
        if (isOwner || isAdmins) {
            menu += `╭─────〔 👑 *ADMINISTRATION* 〕\n`
            menu += `┆ ⬆️ *.promote* — Promouvoir admin\n`
            menu += `┆ ⬇️ *.demote* — Révoquer admin\n`
            menu += `┆ 🚪 *.kick* — Expulser un membre\n`
            menu += `┆ 🔇 *.mute* — Fermer le groupe\n`
            menu += `┆ 🔊 *.unmute* — Ouvrir le groupe\n`
            menu += `┆ 🏷️ *.tagall* — Mentionner tout le monde\n`
            menu += `┆ 👻 *.hidetag* — Mention discrète\n`
            menu += `┆ 🗑️ *.delete* — Supprimer un message\n`
            menu += `┆ 🧹 *.delgrp* — Purger des messages\n`
            menu += `┆ ➕ *.addmod* / *.delmod* — Gérer les mods\n`
            menu += `╰──────────────────────────\n\n`

            menu += `╭─────〔 🛡️ *GESTION DES GROUPES* 〕\n`
            menu += `┆ 🔗 *.antilink* — Bloquer les liens\n`
            menu += `┆ 📜 *.setrules* / *.rules* — Règles\n`
            menu += `┆ ⚠️ *.warn* — Avertir un membre\n`
            menu += `┆ 📊 *.warnings* / *.resetwarn* — Stats\n`
            menu += `┆ 🔢 *.setwarnlimit* — Seuil d'expulsion\n`
            menu += `┆ 🔒 *.close* / 🔓 *.open* — Accès groupe\n`
            menu += `┆ ⏰ *.autoclose* / *.autoopen* — Planifier\n`
            menu += `┆ 📋 *.grp* — Menu complet groupes\n`
            menu += `╰──────────────────────────\n\n`
        }

        // ── Footer ─────────────────────────────────────────────
        menu += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
        menu += `🤖 *Ely Bot* par *${creatorName}*\n`
        menu += `📱 +${creatorNumber}\n`
        menu += `🌐 github.com/YvesElysee/WhatsApp-bot2\n`
        menu += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
        menu += `_Tapez_ \`.list\` _pour voir toutes les commandes._`

        reply(menu)
    }
}
