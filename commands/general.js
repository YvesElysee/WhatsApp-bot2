module.exports = {
    name: 'general',
    commands: ['ping', 'help', 'menu'],
    run: async (sock, m, args, { reply, text }) => {
        const command = m.text.split(' ')[0].slice(1).toLowerCase()

        if (command === 'ping') {
            const start = new Date().getTime()
            await reply('Pong!')
            const end = new Date().getTime()
            await reply(`Response Time: ${end - start}ms`)
        } else if (command === 'help' || command === 'menu') {
            const menu = `
╔══════════════════╗
║     *🤖 ELY-BOT*     ║
╚══════════════════╝

*-- 🛠️ UTILS --*
▸ .ping : _Vitesse du bot_
▸ .pp : _Choper la photo d'un profil_
▸ .extract : _Sauver média (ViewOnce)_
▸ .translate : _Traduire du texte_

*-- 🧠 IA  --*
▸ .ai : _Demander à GPT-3.5_
▸ .gemini : _Demander à Gemini Pro_

*-- 🎬 MÉDIA --*
▸ .sticker : _Image/Vidéo -> Sticker_
▸ .play : _Jouer une musique YouTube_
▸ .chipmunk : _Effet voix d'écureuil_

*-- 🎮 JEUX --*
▸ .games : _Menu des mini-jeux_
▸ .quiz : _Tester votre culture_
▸ .devine : _Deviner le nombre_

*-- 👑 ADMIN --*
▸ .admin : _Gestion du groupe_

_Propulsé par Elysée_
            `
            await reply(menu.trim())
        }
    }
}
