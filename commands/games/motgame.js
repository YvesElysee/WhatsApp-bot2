const MOTS = [
    'WHATSAPP', 'PYTHON', 'JAVASCRIPT', 'TELEPHONE', 'ORDINATEUR', 'INTERNET',
    'PROGRAMMATION', 'AFRIQUE', 'CAMEROUN', 'MUSIQUE', 'STOCKAGE', 'VIRUS',
    'MESSAGE', 'GROUPE', 'STICKER', 'ADMINISTRATEUR', 'DEVELOPPEUR', 'BASEDEDONNEES'
]

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
        if (global.db.games[from]) return reply('❌ Une partie est déjà en cours ici ! Utilisez `.stopgame`.')

        const mot = MOTS[Math.floor(Math.random() * MOTS.length)]
        const sender = m.sender || m.key.participant || m.key.remoteJid
        let tentatives = 3

        global.db.games[from] = {
            type: 'motgame',
            mot,
            tentatives,
            listener: async (sock2, m2, { body, sender: joueur, reply: repondreJeu }) => {
                const partie = global.db.games[from]
                if (!partie) return

                const proposition = String(body || '').trim().toUpperCase()
                if (!/^[A-ZÀ-ÿ]+$/.test(proposition)) return // uniquement des mots

                if (proposition === partie.mot) {
                    await repondreJeu(
                        `🎉 BRAVO @${global.jidToNumber(joueur)} !\nLe mot était bien *${partie.mot}* !`,
                        { mentions: [joueur] }
                    )
                    delete global.db.games[from]
                    return
                }

                partie.tentatives--
                if (partie.tentatives <= 0) {
                    await repondreJeu(`⏰ Plus d'essais ! Le mot était : *${partie.mot}*`)
                    delete global.db.games[from]
                } else {
                    await repondreJeu(`❌ Ce n'est pas ça ! Il reste *${partie.tentatives}* essai(s).`)
                }
            }
        }

        reply(
            `🎯 *JEU DU MOT MÉLANGÉ* 🎯\n\n` +
            `Remettez les lettres dans l'ordre :\n👉 *${melanger(mot)}*\n\n` +
            `👉 @${global.jidToNumber(sender)}, envoyez le mot complet en réponse.\n` +
            `_3 essais — pour arrêter, tapez_ \`.stopgame\``,
            { mentions: [sender] }
        )
    }
}
