module.exports = {
    name: 'games',
    commands: ['games', 'truth', 'dare', 'guess'],
    run: async (sock, m, args, { reply, text }) => {
        const command = m.text.split(' ')[0].slice(1).toLowerCase()

        if (command === 'games') {
            const menu = `
*🎮 Ely-bot Games Arcade 🎮*

- .truth : 🤫 Une vérité embarrassante ?
- .dare : 😈 Un défi risqué ?
- .guess : 🔢 Devine le nombre (1-10)

Amusez-vous bien !
            `
            await reply(menu.trim())
        }

        // We already have truth/dare in ai.js, but user asked for "games command".
        // I will move truth/dare logic here later or just reference it in the help.
        // For now, let's implement a simple guess game here.

        else if (command === 'guess') {
            // Very simple stateless version for demonstration
            // State management would require a database or in-memory object map
            const secret = Math.floor(Math.random() * 10) + 1
            if (!text) return reply('Devinez un nombre entre 1 et 10 ! Exemple: .guess 5')
            const userGuess = parseInt(text)
            if (isNaN(userGuess)) return reply('Ce n\'est pas un nombre !')

            if (userGuess === secret) {
                reply(`🎉 GAGNÉ ! Le nombre était bien ${secret}.`)
            } else {
                reply(`❌ Perdu ! Le nombre était ${secret}. Essaie encore !`)
            }
        }
    }
}
