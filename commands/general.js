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
*WhatsApp Bot Help Menu*

*General*
- .ping : Check bot speed
- .help : Show this menu
- .pp : Get profile picture

*Media*
- .sticker : Convert image/video to sticker
- .play [query] : Play song from YouTube
- .chipmunk : Apply voice effect (reply to audio)
- .extract : Save view-once media (auto)

*AI & Fun*
- .ai [query] : Ask AI
- .truth : Truth or Dare (Truth)
- .dare : Truth or Dare (Dare)
- .translate [lang] [text] : Translate text

*Admin*
- .kick @user
- .add @user
- .promote @user
- .demote @user
- .hidetag [text]

_Created by Antigravity_
            `
            // Send image with caption if you want, but text is fine for now
            await reply(menu.trim())
        }
    }
}
