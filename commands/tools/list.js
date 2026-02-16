module.exports = {
    name: 'list',
    run: async (sock, m, args, { reply, commands }) => {
        let text = '📜 *LISTE DES COMMANDES*\n\n'
        const allCmds = Array.from(commands.keys()).sort()
        allCmds.forEach((cmd, i) => {
            text += `${i + 1}. .${cmd}\n`
        })
        reply(text)
    }
}
