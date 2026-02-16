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
*🌟 Ely-bot Help Menu 🌟*

*General*
- .ping : Vérifier la vitesse
- .help : Afficher ce menu
- .pp : Photo de profil

*🎮 Jeux*
- .games : Menu des jeux (Truth, Dare, Guess)

*🤖 IA & Fun*
- .ai [question] : Poser une question à Ely (IA)
- .translate [lang] [text] : Traduire

*🎵 Média*
- .sticker : Créer un sticker
- .play [titre] : Jouer une musique
- .chipmunk : Effet voix de chipmunk

*👑 Admin*
- .admin : Menu administrateur

_Développé avec ❤️ par Ely_
            `
            // Send image with caption if you want, but text is fine for now
            await reply(menu.trim())
        }
    }
}
