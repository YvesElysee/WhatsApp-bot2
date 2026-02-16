module.exports = {
    name: 'menu',
    run: async (sock, m, args, { reply }) => {
        const menu = `
╔══════════════════╗
║     *🤖 ELY-BOT*     ║
╚══════════════════╝

👋 Bienvenue sur Ely-bot !

🛠 *OUTILS*
▸ .ping, .list, .pp, .extract

👑 *ADMIN*
▸ .kick, .promote, .demote, .hidetag

🧠 *IA*
▸ .ai, .gemini, .translate

🎮 *JEUX*
▸ .quiz, .devine, .guess, .morpion, .pendu

🎞 *MÉDIA*
▸ .sticker, .play

_Tapez .list pour voir tout !_
`
        reply(menu.trim())
    }
}
