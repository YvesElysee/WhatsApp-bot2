module.exports = {
    name: 'puissance4',
    category: 'games',
    desc: 'Jeu de Puissance 4. Alignez 4 jetons pour gagner !',
    commands: ['p4', 'connect4', 'puissance4'],
    run: async (sock, m, args, { reply }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Une partie est déjà en cours dans ce chat !')

        const player1 = sock.decodeJid(m.key.participant || m.key.remoteJid)
        let player2Jid = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
        let isAI = false

        if (!player2Jid || args.includes('solo') || args.includes('ia')) {
            isAI = true
            player2Jid = 'AI_BOT'
        } else {
            player2Jid = sock.decodeJid(player2Jid)
        }

        if (player1 === player2Jid) return reply('❌ Vous ne pouvez pas jouer contre vous-même.')

        // Board 6 rows x 7 cols
        const rows = 6
        const cols = 7
        const board = Array(rows).fill(null).map(() => Array(cols).fill('⚪'))

        const renderBoard = (b) => {
            let out = '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣\n'
            for (let r = 0; r < rows; r++) {
                out += b[r].join('') + '\n'
            }
            return out
        }

        const checkWin = (b, symbol) => {
            // Horizontal
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols - 3; c++) {
                    if (b[r][c] === symbol && b[r][c + 1] === symbol && b[r][c + 2] === symbol && b[r][c + 3] === symbol) return true
                }
            }
            // Vertical
            for (let r = 0; r < rows - 3; r++) {
                for (let c = 0; c < cols; c++) {
                    if (b[r][c] === symbol && b[r + 1][c] === symbol && b[r + 2][c] === symbol && b[r + 3][c] === symbol) return true
                }
            }
            // Diagonal /
            for (let r = 3; r < rows; r++) {
                for (let c = 0; c < cols - 3; c++) {
                    if (b[r][c] === symbol && b[r - 1][c + 1] === symbol && b[r - 2][c + 2] === symbol && b[r - 3][c + 3] === symbol) return true
                }
            }
            // Diagonal \
            for (let r = 0; r < rows - 3; r++) {
                for (let c = 0; c < cols - 3; c++) {
                    if (b[r][c] === symbol && b[r + 1][c + 1] === symbol && b[r + 2][c + 2] === symbol && b[r + 3][c + 3] === symbol) return true
                }
            }
            return false
        }

        const isFull = (b) => b[0].every(cell => cell !== '⚪')

        const dropToken = (b, col, symbol) => {
            for (let r = rows - 1; r >= 0; r--) {
                if (b[r][col] === '⚪') {
                    b[r][col] = symbol
                    return true
                }
            }
            return false
        }

        global.db.games[from] = {
            type: 'puissance4',
            players: [player1, player2Jid],
            symbols: ['🔴', '🟡'],
            turn: 0,
            board,
            isAI,
            lastUpdate: Date.now()
        }

        global.db.games[from].listener = async (sock, m, { body, sender, reply }) => {
            const game = global.db.games[from]
            if (!game || game.type !== 'puissance4') return

            if (sender !== game.players[game.turn]) return

            const col = parseInt(body) - 1
            if (isNaN(col) || col < 0 || col >= cols) return

            if (!dropToken(game.board, col, game.symbols[game.turn])) return reply('❌ Colonne pleine !')

            game.lastUpdate = Date.now()

            if (checkWin(game.board, game.symbols[game.turn])) {
                reply(`🏆 *PUISSANCE 4* 🏆\n\n${renderBoard(game.board)}\n🎉 @${sender.split('@')[0]} a gagné !`, { mentions: [sender] })
                delete global.db.games[from]
                return
            }

            if (isFull(game.board)) {
                reply(`🤝 *PUISSANCE 4 : MATCH NUL* 🤝\n\n${renderBoard(game.board)}`, { mentions: game.players.filter(p => p !== 'AI_BOT') })
                delete global.db.games[from]
                return
            }

            game.turn = 1 - game.turn

            if (game.isAI && game.players[game.turn] === 'AI_BOT') {
                // Simple AI: tries to win, block, or random
                let aiCol = -1
                // Try win
                for (let c = 0; c < cols; c++) {
                    let tempBoard = game.board.map(r => [...r])
                    if (dropToken(tempBoard, c, '🟡')) {
                        if (checkWin(tempBoard, '🟡')) { aiCol = c; break }
                    }
                }
                // Try block
                if (aiCol === -1) {
                    for (let c = 0; c < cols; c++) {
                        let tempBoard = game.board.map(r => [...r])
                        if (dropToken(tempBoard, c, '🔴')) {
                            if (checkWin(tempBoard, '🔴')) { aiCol = c; break }
                        }
                    }
                }
                // Random
                if (aiCol === -1) {
                    const validCols = game.board[0].map((cell, i) => cell === '⚪' ? i : null).filter(i => i !== null)
                    aiCol = validCols[Math.floor(Math.random() * validCols.length)]
                }

                dropToken(game.board, aiCol, '🟡')

                if (checkWin(game.board, '🟡')) {
                    reply(`🏆 *PUISSANCE 4* 🏆\n\n${renderBoard(game.board)}\n🤖 L'IA a gagné !`, { mentions: [game.players[0]] })
                    delete global.db.games[from]
                } else if (isFull(game.board)) {
                    reply(`🤝 *MATCH NUL* 🤝\n\n${renderBoard(game.board)}`)
                    delete global.db.games[from]
                } else {
                    game.turn = 1 - game.turn
                    reply(`🎮 *PUISSANCE 4* 🎮\n\n${renderBoard(game.board)}\n🤖 L'IA a joué en colonne ${aiCol + 1}.\n👉 @${game.players[game.turn].split('@')[0]}, à toi !`, { mentions: [game.players[game.turn]] })
                }
            } else {
                reply(`🎮 *PUISSANCE 4* 🎮\n\n${renderBoard(game.board)}\n👉 @${game.players[game.turn].split('@')[0]} (${game.symbols[game.turn]}), à toi !`, { mentions: [game.players[game.turn]] })
            }
        }

        const opponent = isAI ? '🤖 IA' : `@${player2Jid.split('@')[0]}`
        reply(`🎮 *PUISSANCE 4* 🎮\n\n${renderBoard(board)}\n🔴 @${player1.split('@')[0]}\n🟡 ${opponent}\n\n👉 @${player1.split('@')[0]}, choisis une colonne (1-7) !`, { mentions: [player1, player2Jid] })
    }
}
