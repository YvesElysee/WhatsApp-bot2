const { demanderSuite, essaisPour, partieEnCours, difficulteDe } = require('../../lib/jeux')

const MOTS = [
    'WHATSAPP', 'PYTHON', 'JAVASCRIPT', 'TELEPHONE', 'ORDINATEUR', 'INTERNET',
    'PROGRAMMATION', 'AFRIQUE', 'CAMEROUN', 'MUSIQUE', 'STOCKAGE', 'VIRUS',
    'MESSAGE', 'GROUPE', 'STICKER', 'ADMINISTRATEUR', 'DEVELOPPEUR', 'BASEDEDONNEES'
]

// Essais selon le niveau (`.niveau`) — un indice est donné après
// le premier essai raté (première lettre + longueur du mot).
const ESSAIS = { facile: 5, moyen: 3, difficile: 2 }

const melanger = (mot) => {
    let melange = mot
    let essais = 0
    // On mélange jusqu'à obtenir un ordre différent (et lisible)
    while (melange === mot && essais < 10) {
        melange = mot.split('').sort(() => Math.random() - 0.5).join('')
        essais++
    }
    return melange
}

module.exports = {
    name: 'motgame',
    category: 'games',
    desc: 'Remettez les lettres du mot mélangé dans le bon ordre.',
    commands: ['motgame', 'motus', 'motmelange'],
    run: async (sock, m, args, { reply }) => {
        const from = m.key.remoteJid
        if (partieEnCours(from)) return reply('❌ Une partie est déjà en cours ici ! Utilisez `.stopgame`.')

        const niveau = difficulteDe(from)
        const sender = m.sender || m.key.participant || m.key.remoteJid

        // Nouvelle manche (réutilisée par « on continue ? »)
        const lancerManche = async (repondre, joueur) => {
            const mot = MOTS[Math.floor(Math.random() * MOTS.length)]
            let essais = essaisPour(from, ESSAIS)
            let indiceDonne = false

            global.db.games[from] = {
                type: 'motgame',
                mot,
                listener: async (sock2, m2, { body, sender: joueur2, reply: r }) => {
                    const partie = global.db.games[from]
                    if (!partie || partie.type !== 'motgame') return

                    const proposition = String(body || '').trim().toUpperCase()
                    if (!/^[A-ZÀ-ÿ]+$/.test(proposition)) return // uniquement des mots

                    if (proposition === partie.mot) {
                        const bilan = `🎉 BRAVO @${global.jidToNumber(joueur2)} !\nLe mot était bien *${partie.mot}* !`
                        delete global.db.games[from]
                        return demanderSuite(from, r, bilan, () => lancerManche(r, joueur2), { mentions: [joueur2] })
                    }

                    // Faux : au premier raté, un indice ; puis compteur d'essais
                    essais--
                    if (!indiceDonne) {
                        indiceDonne = true
                        await r(
                            `❌ Ce n'est pas ça !\n` +
                            `💡 *Indice :* le mot contient *${mot.length}* lettres et commence par *${mot[0]}*.\n` +
                            `❤️ Essais restants : *${essais}*`
                        )
                    } else if (essais > 0) {
                        await r(`❌ Toujours pas ! Il reste *${essais}* essai(s).`)
                    } else {
                        const bilan = `⏰ Plus d'essais ! Le mot était : *${partie.mot}*`
                        delete global.db.games[from]
                        await demanderSuite(from, r, bilan, () => lancerManche(r, joueur2))
                    }
                }
            }

            await repondre(
                `🎯 *JEU DU MOT MÉLANGÉ* 🎯\n\n` +
                `Remettez les lettres dans l'ordre :\n👉 *${melanger(mot)}*\n\n` +
                `🎚️ Niveau *${niveau.toUpperCase()}* — ${essais} essai(s), un indice au premier raté.\n` +
                `👉 @${global.jidToNumber(joueur)}, envoyez le mot complet.\n` +
                `_Pour arrêter, tapez_ \`.stopgame\``,
                { mentions: [joueur] }
            )
        }

        await lancerManche(reply, sender)
    }
}
