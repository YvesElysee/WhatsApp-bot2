module.exports = {
    name: 'menu',
    category: 'tools',
    desc: 'Affiche le menu principal (Hub).',
    commands: ['menu', 'help'],
    run: async (sock, m, args, { reply, isOwner, isAdmins }) => {
        const pushname = m.pushName || "Cher utilisateur"
        const creatorName = global.author || "Ely"
        const creatorNumber = global.owner[0] || "237697353272"

        let menuText = `╔══════════════════════╗\n` +
            `║     ✨ *ELY-BOT HUB* ✨   ║\n` +
            `╚══════════════════════╝\n\n` +
            `👋 Salut *${pushname}* !\n` +
            `Bienvenue sur mon interface de contrôle.\n\n` +
            `👤 *CRÉATEUR* : ${creatorName}\n` +
            `📞 *CONTACT* : +${creatorNumber}\n\n` +
            `--- *CATÉGORIES DISPONIBLES* ---\n\n` +
            `🧠 *INTELLIGENCE ARTIFICIELLE*\n` +
            `👉 Tapez \`.ai\` pour voir les commandes IA.\n\n` +
            `🎮 *DIVERTISSEMENT & JEUX*\n` +
            `👉 Tapez \`.game\` pour voir les jeux.\n\n` +
            `🛠 *OUTILS & UTILITAIRES*\n` +
            `👉 Tapez \`.tools\` pour voir les outils.\n\n` +
            `🎞 *MÉDIAS (PLAY/DL)*\n` +
            `👉 Tapez \`.dl\` pour voir les commandes média.\n\n` +
            `⚙ *RÉGLAGES BOT*\n` +
            `👉 Tapez \`.settings\` pour les réglages.\n\n`

        if (isOwner || isAdmins) {
            menuText += `👑 *ADMINISTRATION*\n` +
                `👉 Tapez \`.admin\` pour les outils de gestion.\n\n`
        }

        menuText += `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `_Besoin d'aide ? Contactez mon créateur !_`

        reply(menuText.trim())
    }
}
