module.exports = {
    name: 'menu',
    run: async (sock, m, args, { reply }) => {
        const menu = `
╔══════════════════╗
║     *🤖 ELY-BOT* ║
╚══════════════════╝

👋 Bienvenue sur Ely-bot !

🛠 *OUTILS*
▸ .ping, .list, .pp, .extract, .tts

⚙ *REGLAGES*
▸ .antidelete [on/off]
▸ .autoreact [on/off]
▸ .mode [public/private]

👑 *ADMIN*
▸ .kick, .promote, .demote, .hidetag

🧠 *IA*
▸ .ai, .gemini, .translate, .stt

🎮 *JEUX*
▸ .quiz, .devine, .guess, .morpion, .pendu

🎞 *MÉDIA*
▸ .sticker, .play

_Tapez .list pour voir tout !_
`
        reply(menu.trim())
    }
}
