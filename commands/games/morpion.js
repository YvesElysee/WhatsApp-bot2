module.exports = {
    name: 'morpion',
    category: 'games',
    desc: 'Jeu de morpion (Tic-Tac-Toe).',
    commands: ['morpion', 'ttt', 'tic'],
    run: async (sock, m, args, { reply, isGroup }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Une partie est déjà en cours dans ce chat ! Tapez `.stopgame` pour l\'arrêter.')

        let player1 = sock.decodeJid(m.key.participant || m.key.remoteJid)
        let player2 = sock.decodeJid(m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null))

        if (!player2) return reply('❌ Mentionnez un adversaire ou répondez à son message !')
        if (player1 === player2) return reply('❌ Vous ne pouvez pas jouer contre vous-même.')

        const board = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

        const renderBoard = () => {
            return `\n    ${board[0]} | ${board[1]} | ${board[2]}\n    ──────────\n    ${board[3]} | ${board[4]} | ${board[5]}\n    ──────────\n    ${board[6]} | ${board[7]} | ${board[8]}\n`
        }

        const checkWin = () => {
            const wins = [
                [0, 1, 2], [3, 4, 5], [6, 7, 8],
                [0, 3, 6], [1, 4, 7], [2, 5, 8],
                [0, 4, 8], [2, 4, 6]
            ]
            for (let w of wins) {
                if (board[w[0]] === board[w[1]] && board[w[1]] === board[w[2]]) return board[w[0]]
            }
            if (board.every(s => s === '✖️' || s === '⭕')) return 'tie'
            return null
        }

        global.db.games[from] = {
            type: 'morpion',
            players: [player1, player2],
            symbols: ['✖️', '⭕'],
            turn: 0,
            board,
            listener: async (sock, m, { body, sender, reply }) => {
                const game = global.db.games[from]
                if (!game || game.type !== 'morpion') return

                if (sender !== game.players[game.turn]) return

                const move = parseInt(body) - 1
                if (isNaN(move) || move < 0 || move > 8 || board[move] === '✖️' || board[move] === '⭕') return

                board[move] = game.symbols[game.turn]
                const win = checkWin()

                if (win) {
                    let msg = `🏆 *MORPION RESULTAT* 🏆\n${renderBoard()}\n`
                    if (win === 'tie') {
                        msg += '🤝 *MATCH NUL !* Bravo aux deux joueurs.'
                    } else {
                        msg += `🎉 *VICTOIRE !* @${sender.split('@')[0]} a gagné la partie !`
                    }
                    reply(msg, { mentions: [sender] })
                    delete global.db.games[from]
                } else {
                    game.turn = 1 - game.turn
                    let msg = `🎮 *MORPION SESSION* 🎮\n${renderBoard()}\n👉 Au tour de @${game.players[game.turn].split('@')[0]} (${game.symbols[game.turn]})`
                    reply(msg, { mentions: [game.players[game.turn]] })
                }
            }
        }

        reply(`🎮 *DÉBUT DU MORPION* 🎮\n${renderBoard()}\n👤 @${player1.split('@')[0]} (✖️)\n👤 @${player2.split('@')[0]} (⭕)\n\n👉 @${player1.split('@')[0]}, tapez un chiffre pour commencer !`, { mentions: [player1, player2] })
    }
}
