module.exports = {
    name: 'ping',
    run: async (sock, m, args, { reply }) => {
        const start = Date.now()
        await reply('Pong! 🏓')
        const end = Date.now()
        reply(`Latence: ${end - start}ms`)
    }
}
