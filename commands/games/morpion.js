module.exports = {
    name: 'morpion',
    commands: ['morpion', 'ttt', 'tic'],
    run: async (sock, m, args, { reply, isGroup }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Une partie est déjà en cours ici !')

        const board = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
        let player1 = sock.decodeJid(m.key.participant || m.key.remoteJid)
        let player2 = m.mentionedJid[0] || (m.quoted ? m.quoted.sender : null)

        if (!player2) return reply('❌ Mentionnez un adversaire !')
        if (player1 === player2) return reply('❌ Jouez avec quelqu\'un d\'autre.')

        const renderBoard = () => {
            return `
  ${board[0]} | ${board[1]} | ${board[2]}
 ---+---+---
  ${board[3]} | ${board[4]} | ${board[5]}
 ---+---+---
  ${board[6]} | ${board[7]} | ${board[8]}
`
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
            if (board.every(s => s === 'X' || s === 'O')) return 'tie'
            return null
        }

        global.db.games[from] = {
            type: 'morpion',
            players: [player1, player2],
            turn: 0,
            board,
            listener: async (sock, m, { body, sender, reply }) => {
                const game = global.db.games[from]
                if (sender !== game.players[game.turn]) return

                const move = parseInt(body) - 1
                if (isNaN(move) || move < 0 || move > 8 || board[move] === 'X' || board[move] === 'O') return

                board[move] = game.turn === 0 ? 'X' : 'O'
                const win = checkWin()

                if (win) {
                    let msg = `🎮 *MORPION RESULTAT*\n${renderBoard()}\n`
                    if (win === 'tie') msg += '🤝 Égalité !'
                    else msg += `🎉 @${sender.split('@')[0]} a gagné !`
                    reply(msg)
                    delete global.db.games[from]
                } else {
                    game.turn = 1 - game.turn
                    let msg = `🎮 *MORPION*\n${renderBoard()}\nC'est au tour de @${game.players[game.turn].split('@')[0]}`
                    reply(msg)
                }
            }
        }

        reply(`🎮 *DEBUT MORPION*\n${renderBoard()}\n@${player1.split('@')[0]} (X) VS @${player2.split('@')[0]} (O)\n\nC'est à @${player1.split('@')[0]} de commencer ! Tapez un chiffre (1-9).`)
    }
}
