// ─────────────────────────────────────────────────────────
// MORPION (Tic-Tac-Toe) 3x3 — solo (IA) ou contre un ami
// L'affichage montre le numéro de chaque case libre, ce qui
// rend la saisie intuitive (tapez 1 à 9).
// ─────────────────────────────────────────────────────────

const IA = 'AI_BOT'
const VIDE = '⬜'

const NUMEROS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

const LIGNES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rangées
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // colonnes
    [0, 4, 8], [2, 4, 6]             // diagonales
]

const rendrePlateau = (plateau) =>
    `${plateau[0]} │ ${plateau[1]} │ ${plateau[2]}\n──┼───┼──\n` +
    `${plateau[3]} │ ${plateau[4]} │ ${plateau[5]}\n──┼───┼──\n` +
    `${plateau[6]} │ ${plateau[7]} │ ${plateau[8]}`

const cellules = (plateau) => plateau.map((c, i) => (c === VIDE ? NUMEROS[i] : c))

const gagnant = (plateau) => {
    for (const [a, b, c] of LIGNES) {
        if (plateau[a] !== VIDE && plateau[a] === plateau[b] && plateau[b] === plateau[c]) return plateau[a]
    }
    return plateau.every(c => c !== VIDE) ? 'tie' : null
}

// IA simple mais efficace : gagne si possible, bloque sinon, puis coin/centre
const coupIA = (plateau, symbole, adverse) => {
    const essayer = (s) => {
        for (const [a, b, c] of LIGNES) {
            const l = [a, b, c]
            const marques = l.filter(i => plateau[i] === s).length
            const libres = l.filter(i => plateau[i] === VIDE)
            if (marques === 2 && libres.length === 1) return libres[0]
        }
        return -1
    }
    let p = essayer(symbole)
    if (p === -1) p = essayer(adverse)
    if (p === -1 && plateau[4] === VIDE) p = 4
    if (p === -1) {
        const coins = [0, 2, 6, 8].filter(i => plateau[i] === VIDE)
        if (coins.length) p = coins[Math.floor(Math.random() * coins.length)]
    }
    if (p === -1) {
        const libres = plateau.map((c, i) => (c === VIDE ? i : -1)).filter(i => i !== -1)
        if (libres.length) p = libres[Math.floor(Math.random() * libres.length)]
    }
    return p
}

module.exports = {
    name: 'morpion',
    category: 'games',
    desc: 'Morpion (Tic-Tac-Toe) : contre l\'IA ou un ami.',
    commands: ['morpion', 'ttt', 'tic', 'tictactoe'],
    run: async (sock, m, args, { reply, isGroup }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Une partie est déjà en cours ici ! Utilisez `.stopgame`.')

        const sender = m.sender || m.key.participant || m.key.remoteJid
        let player2 = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)

        // Menu de choix du mode
        if (!args[0] && !player2) {
            return reply(
                `🎮 *MORPION* 🎮\n\n` +
                `Choisissez votre mode :\n\n` +
                `1️⃣ \`.morpion solo\` — contre l'IA\n` +
                `2️⃣ \`.morpion @ami\` — contre un ami\n\n` +
                `Objectif : aligner 3 symboles !`
            )
        }

        const estSolo = args[0]?.toLowerCase() === 'solo' || args[0]?.toLowerCase() === 'ia' || !player2

        if (estSolo) {
            player2 = IA
        } else {
            player2 = sock.decodeJid(player2)
            if (global.sameJid(player2, sender)) return reply('❌ On ne peut pas jouer contre soi-même !')
        }

        const plateau = Array(9).fill(VIDE)
        const symboles = ['❌', '⭕']

        const annonce =
            `🎮 *MORPION* 🎮\n\n` +
            `${rendrePlateau(plateau)}\n\n` +
            `👤 Joueur 1 : @${global.jidToNumber(sender)} (${symboles[0]})\n` +
            `👤 Joueur 2 : ${estSolo ? '🤖 IA' : '@' + global.jidToNumber(player2) + ' (' + symboles[1] + ')'}\n\n` +
            `👉 À @${global.jidToNumber(sender)} de jouer : tapez un chiffre de *1 à 9*.`

        global.db.games[from] = {
            type: 'morpion',
            players: [sender, player2],
            symbols: symboles,
            board: plateau,
            turn: 0,
            isAI: estSolo,
            listener: async (sock2, m2, { body, joueur, sender: joueurQuiJoue, reply: r }) => {
                const partie = global.db.games[from]
                if (!partie) return

                const tour = partie.players[partie.turn]
                if (!global.sameJid(joueurQuiJoue, tour)) return

                const pos = parseInt(String(body || '').trim(), 10)
                if (isNaN(pos) || pos < 1 || pos > 9) return
                if (partie.board[pos - 1] !== VIDE) return r('❌ Cette case est déjà occupée ! Choisissez un autre chiffre.')

                partie.board[pos - 1] = partie.symbols[partie.turn]

                let fin = gagnant(partie.board)
                if (fin) {
                    const texte = fin === 'tie'
                        ? '🤝 *Match nul !*'
                        : `🎉 *Victoire de @${global.jidToNumber(joueurQuiJoue)} !*`
                    return r(`🏆 *MORPION* 🏆\n\n${rendrePlateau(partie.board)}\n\n${texte}`, { mentions: [joueurQuiJoue] })
                }

                partie.turn = 1 - partie.turn

                if (partie.isAI && partie.players[partie.turn] === IA) {
                    const coup = coupIA(partie.board, partie.symbols[1], partie.symbols[0])
                    partie.board[coup] = partie.symbols[1]

                    fin = gagnant(partie.board)
                    if (fin) {
                        const texte = fin === 'tie' ? '🤝 *Match nul !*' : '🤖 *L\'IA a gagné !*'
                        return r(`🏆 *MORPION* 🏆\n\n${rendrePlateau(partie.board)}\n\n${texte}`)
                    }

                    partie.turn = 0
                    return r(
                        `🎮 *MORPION* 🎮\n\n${rendrePlateau(partie.board)}\n\n` +
                        `🤖 L'IA a joué en case ${coup + 1}.\n` +
                        `👉 À @${global.jidToNumber(partie.players[0])} de jouer (${partie.symbols[0]}).`,
                        { mentions: [partie.players[0]] }
                    )
                }

                return r(
                    `🎮 *MORPION* 🎮\n\n${rendrePlateau(partie.board)}\n\n` +
                    `👉 Au tour de @${global.jidToNumber(partie.players[partie.turn])} (${partie.symbols[partie.turn]}).`,
                    { mentions: [partie.players[partie.turn]] }
                )
            }
        }

        reply(annonce, {
            mentions: estSolo ? [sender] : [sender, player2]
        })
    }
}
