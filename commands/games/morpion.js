module.exports = {
    name: 'morpion',
    category: 'games',
    desc: 'Jeu de morpion (Tic-Tac-Toe). Jouez contre un ami ou l\'IA.',
    commands: ['morpion', 'ttt', 'tic'],
    run: async (sock, m, args, { reply, isGroup }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Une partie est déjà en cours ici !')

        const sender = sock.decodeJid(m.key.participant || m.key.remoteJid)
        let player2 = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)

        // --- Standardized Launch Flow ---
        if (!args[0] && !player2) {
            return reply(`🎮 *MORPION 10x10* 🎮\n\nChoisissez votre mode :\n1️⃣ *.morpion solo* (contre l'IA)\n2️⃣ *.morpion @ami* (contre un ami)`)
        }

        let isAI = false
        if (args[0] === 'solo' || args[0] === 'ia' || !player2) {
            isAI = true
            player2 = 'AI_BOT'
        } else {
            player2 = sock.decodeJid(player2)
        }

        if (sender === player2) return reply('❌ Jouer contre soi-même ? Vraiment ?')

        // 9x9 Board
        const size = 9
        const board = Array(size * size).fill('⬜')

        const renderBoard = (b) => {
            let out = '  1 2 3 4 5 6 7 8 9\n'
            for (let i = 0; i < size; i++) {
                const row = b.slice(i * size, (i + 1) * size)
                out += `${i + 1} ${row.join('')}\n`
            }
            return out
        }

        const checkWin = (b) => {
            const winLen = 5
            // Horizontal
            for (let r = 0; r < size; r++) {
                for (let c = 0; c <= size - winLen; c++) {
                    const line = b.slice(r * size + c, r * size + c + winLen)
                    if (line.every(v => v === '❌') || line.every(v => v === '⭕')) return line[0]
                }
            }
            // Vertical
            for (let c = 0; c < size; c++) {
                for (let r = 0; r <= size - winLen; r++) {
                    let symbols = []
                    for (let i = 0; i < winLen; i++) symbols.push(b[(r + i) * size + c])
                    if (symbols.every(v => v === '❌') || symbols.every(v => v === '⭕')) return symbols[0]
                }
            }
            // Diagonal \
            for (let r = 0; r <= size - winLen; r++) {
                for (let c = 0; c <= size - winLen; c++) {
                    let symbols = []
                    for (let i = 0; i < winLen; i++) symbols.push(b[(r + i) * size + (c + i)])
                    if (symbols.every(v => v === '❌') || symbols.every(v => v === '⭕')) return symbols[0]
                }
            }
            // Diagonal /
            for (let r = 0; r <= size - winLen; r++) {
                for (let c = winLen - 1; c < size; c++) {
                    let symbols = []
                    for (let i = 0; i < winLen; i++) symbols.push(b[(r + i) * size + (c - i)])
                    if (symbols.every(v => v === '❌') || symbols.every(v => v === '⭕')) return symbols[0]
                }
            }
            if (b.every(v => v !== '⬜')) return 'tie'
            return null
        }

        const aiMove = (b) => {
            const empty = b.map((v, i) => v === '⬜' ? i : null).filter(v => v !== null)
            // Simpler AI for large grid: prefer center-ish empty spots or random
            return empty[Math.floor(Math.random() * empty.length)]
        }

        global.db.games[from] = {
            type: 'morpion',
            players: [sender, player2],
            board,
            turn: 0,
            isAI,
            symbols: ['❌', '⭕']
        }

        global.db.games[from].listener = async (sock, m, { body, sender: mover }) => {
            const game = global.db.games[from]
            if (!game || mover !== game.players[game.turn]) return

            const pos = parseInt(body) - 1
            if (isNaN(pos) || pos < 0 || pos > 99 || game.board[pos] !== '⬜') return

            game.board[pos] = game.symbols[game.turn]
            let winner = checkWin(game.board)

            if (winner) {
                const resMsg = winner === 'tie' ? '🤝 *Match Nul !*' : `🎉 *Victoire de @${mover.split('@')[0]} !*`
                reply(`🏆 *MORPION 10x10* 🏆\n${renderBoard(game.board)}\n${resMsg}`, { mentions: [mover] })
                delete global.db.games[from]
                return
            }

            game.turn = 1 - game.turn

            if (game.isAI) {
                const aiPos = aiMove(game.board)
                game.board[aiPos] = game.symbols[1]
                winner = checkWin(game.board)

                if (winner) {
                    const resMsg = winner === 'tie' ? '🤝 *Match Nul !*' : `🤖 *L'IA a gagné !*`
                    reply(`🏆 *MORPION 10x10* 🏆\n${renderBoard(game.board)}\n${resMsg}`)
                    delete global.db.games[from]
                } else {
                    game.turn = 0
                    reply(`🎮 *MORPION 10x10*\n${renderBoard(game.board)}\n🤖 L'IA a joué.\n👉 Au tour de @${game.players[0].split('@')[0]} (❌)`, { mentions: [game.players[0]] })
                }
            } else {
                reply(`🎮 *MORPION 10x10*\n${renderBoard(game.board)}\n👉 Au tour de @${game.players[game.turn].split('@')[0]} (${game.symbols[game.turn]})`, { mentions: [game.players[game.turn]] })
            }
        }

        reply(`🎮 *DÉBUT MORPION 10x10* 🎮\n${renderBoard(board)}\n👤 Joueur 1: @${sender.split('@')[0]}\n👤 Joueur 2: ${isAI ? '🤖 IA' : '@' + player2.split('@')[0]}\n\n👉 Tapez un chiffre entre **1 et 100** !`, { mentions: [sender, player2] })
    }
}
