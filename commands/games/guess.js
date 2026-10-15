const { demanderSuite, essaisPour, partieEnCours, difficulteDe } = require('../../lib/jeux')

// Essais autorisés selon le niveau (`.niveau`) — le bot indique
// toujours PLUS / MOINS, et l'indice de distance après un essai.
const ESSAIS = { facile: 10, moyen: 6, difficile: 4 }

module.exports = {
    name: 'guess',
    category: 'games',
    desc: 'Devinez le nombre choisi par le bot.',
    commands: ['guess', 'devine-nombre'],
    run: async (sock, m, args, { reply }) => {
        const from = m.key.remoteJid
        if (partieEnCours(from)) return reply('❌ Une partie est déjà en cours ici ! Utilisez `.stopgame`.')

        const niveau = difficulteDe(from)
        const secret = Math.floor(Math.random() * 100) + 1
        const sender = m.sender || m.key.participant || m.key.remoteJid

        // Nouvelle manche (réutilisée par « on continue ? »)
        const lancerManche = async (repondre, joueur) => {
            const nombreSecret = Math.floor(Math.random() * 100) + 1
            let essais = essaisPour(from, ESSAIS)
            let tentatives = 0

            global.db.games[from] = {
                type: 'guess',
                secret: nombreSecret,
                listener: async (sock2, m2, { body, sender: joueur2, reply: r }) => {
                    const partie = global.db.games[from]
                    if (!partie || partie.type !== 'guess') return

                    const nombre = parseInt(String(body || '').trim(), 10)
                    if (isNaN(nombre) || nombre < 1 || nombre > 100) return // on ignore le reste

                    tentatives++

                    if (nombre === partie.secret) {
                        const bilan = `🎉 BRAVO @${global.jidToNumber(joueur2)} !\nC'était bien *${partie.secret}* en ${tentatives} tentative(s) !`
                        delete global.db.games[from]
                        return demanderSuite(from, r, bilan, () => lancerManche(r, joueur2), { mentions: [joueur2] })
                    }

                    // Faux : indice PLUS/MOINS + distance quand on approche
                    essais--
                    const distance = Math.abs(nombre - partie.secret)
                    let indice = nombre < partie.secret ? '📈 *PLUS !* Le nombre est au-dessus.' : '📉 *MOINS !* Le nombre est en dessous.'
                    if (essais > 0) {
                        if (distance <= 5) indice += '\n🔥 Vous y êtes presque !'
                        else if (distance <= 15) indice += '\n☀️ Vous êtes proche.'
                        else indice += '\n🧊 Vous êtes loin.'
                        await r(`${indice}\n❤️ Essais restants : *${essais}*`)
                    } else {
                        const bilan = `⏰ Plus d'essais ! Le nombre secret était : *${partie.secret}*`
                        delete global.db.games[from]
                        await demanderSuite(from, r, bilan, () => lancerManche(r, joueur2))
                    }
                }
            }

            await repondre(
                `🔢 *DEVINE LE NOMBRE* 🔢\n\n` +
                `J'ai choisi un nombre entre *1 et 100*.\n` +
                `🎚️ Niveau *${niveau.toUpperCase()}* — ${essais} essai(s).\n` +
                `👉 @${global.jidToNumber(joueur)}, envoyez vos propositions directement !\n\n` +
                `_Pour arrêter, tapez_ \`.stopgame\``,
                { mentions: [joueur] }
            )
        }

        await lancerManche(reply, sender)
    }
}
