module.exports = {
    name: 'menu',
    category: 'tools',
    desc: 'Affiche le menu principal (Hub).',
    commands: ['menu', 'help'],
    run: async (sock, m, args, { reply, isOwner, isAdmins }) => {
        const pushname = m.pushName || "Cher utilisateur"
        const creatorName = global.author || "Ely"
        const creatorNumber = global.owner[0] || "237697353272"

        let menuText = `╔═════❖•ೋ° °ೋ•❖═════╗\n` +
            `    🌟 *ELY BOT ACCUEIL* 🌟\n` +
            `╚═════❖•ೋ° °ೋ•❖═════╝\n\n` +
            `👋 *Salut ${pushname}*,\n` +
            `Ravi de vous revoir sur le centre de commande.\n\n` +
            `╭───〔 👤 *PROFIL* 〕───\n` +
            `┆ 🤵 *Auteur* : ${creatorName}\n` +
            `┆ 📱 *WhatsApp* : +${creatorNumber}\n` +
            `╰───────────────────\n\n` +
            `╭───〔 📁 *LIENS* 〕───\n` +
            `┆ 🌐 *GitHub* : github.com/YvesElysee\n` +
            `┆ 📂 *Clone* : github.com/YvesElysee/WhatsApp-bot2\n` +
            `╰───────────────────\n\n` +
            `╭───〔 📜 *MENU* 〕───\n` +
            `┆ 🧠 .ai - IA & Cerveau\n` +
            `┆ 🎮 .game - Zone de Jeux\n` +
            `┆ 🛠 .tools - Outils Pro\n` +
            `┆ 🎞 .dl - Médias\n` +
            `┆ ⚙ .settings - Configuration\n` +
            `┆ 🤖 .chatbot - Auto-Réponse\n` +
            `┆ ℹ️ .about - À Propos\n` +
            `┆ 📜 .list - Catalogue complet\n` +
            `╰───────────────────\n`

        if (isOwner || isAdmins) {
            menuText += `\n╭───〔 👑 *ADMIN* 〕───\n` +
                `┆ ⚡ .admin - Gestion Groupes\n` +
                `╰───────────────────\n`
        }

        menuText += `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `_Besoin d'aide ? Contactez mon créateur ${creatorName}\n !_`

        reply(menuText.trim())
    }
}
