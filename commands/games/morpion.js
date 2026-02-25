module.exports = {
    name: 'morpion',
    category: 'games',
    desc: 'Jeu de morpion (Tic-Tac-Toe). Jouez contre un ami ou l\'IA.',
    commands: ['morpion', 'ttt', 'tic'],
    run: async (sock, m, args, { reply, isGroup }) => {
        const from = m.key.remoteJid
        if (global.db.games[from]) return reply('❌ Une partie est déjà en cours dans ce chat ! Tapez `.stopgame` pour l\'arrêter.')

        const player1 = sock.decodeJid(m.key.participant || m.key.remoteJid)

        // Mode detection
        let player2Jid = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null)
        let isAI = false

        if (!player2Jid || args.includes('solo') || args.includes('ia')) {
            isAI = true
            player2Jid = 'AI_BOT'
        } else {
            player2Jid = sock.decodeJid(player2Jid)
        }

        if (player1 === player2Jid) return reply('❌ Vous ne pouvez pas jouer contre vous-même.')

        const board = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

        const renderBoard = (b = board) => {
            return `\n    ${b[0]} | ${b[1]} | ${b[2]}\n    ──────────\n    ${b[3]} | ${b[4]} | ${b[5]}\n    ──────────\n    ${b[6]} | ${b[7]} | ${b[8]}\n`
        }

        const checkWin = (b = board) => {
            const wins = [
                [0, 1, 2], [3, 4, 5], [6, 7, 8],
                [0, 3, 6], [1, 4, 7], [2, 5, 8],
                [0, 4, 8], [2, 4, 6]
            ]
            for (let w of wins) {
                if (b[w[0]] === b[w[1]] && b[w[1]] === b[w[2]] && (b[w[0]] === '✖️' || b[w[0]] === '⭕')) return b[w[0]]
            }
            if (b.every(s => s === '✖️' || s === '⭕')) return 'tie'
            return null
        }

        const aiMove = async (gameBoard) => {
            const available = gameBoard.map((s, i) => (s !== '✖️' && s !== '⭕' ? i : null)).filter(i => i !== null)
            // Win check
            for (let i of available) {
                let copy = [...gameBoard]
                copy[i] = '⭕'
                if (checkWin(copy) === '⭕') return i
            }
            // Block check
            for (let i of available) {
                let copy = [...gameBoard]
                copy[i] = '✖️'
                if (checkWin(copy) === '✖️') return i
            }
            // Random
            return available[Math.floor(Math.random() * available.length)]
        }

        global.db.games[from] = {
            type: 'morpion',
            players: [player1, player2Jid],
            symbols: ['✖️', '⭕'],
            turn: 0,
            board,
            isAI,
            lastUpdate: Date.now()
        }

        global.db.games[from].listener = async (sock, m, { body, sender, reply }) => {
            const game = global.db.games[from]
            if (!game || game.type !== 'morpion') return

            if (sender !== game.players[game.turn]) return

            const move = parseInt(body) - 1
            if (isNaN(move) || move < 0 || move > 8 || game.board[move] === '✖️' || game.board[move] === '⭕') return

            game.board[move] = game.symbols[game.turn]
            game.lastUpdate = Date.now()

            let win = checkWin(game.board)

            if (win) {
                let msg = `🏆 *MORPION RESULTAT* 🏆\n${renderBoard(game.board)}\n`
                if (win === 'tie') {
                    msg += '🤝 *MATCH NUL !*'
                } else {
                    msg += `🎉 *VICTOIRE !* @${sender.split('@')[0]} a gagné !`
                }
                reply(msg, { mentions: [sender] })
                delete global.db.games[from]
                return
            }

            game.turn = 1 - game.turn

            if (game.isAI && game.players[game.turn] === 'AI_BOT') {
                const aiIndex = await aiMove(game.board)
                game.board[aiIndex] = game.symbols[game.turn]
                win = checkWin(game.board)

                if (win) {
                    let msg = `🏆 *MORPION RESULTAT* 🏆\n${renderBoard(game.board)}\n`
                    if (win === 'tie') msg += '🤝 *MATCH NUL !*'
                    else msg += `🤖 *L'IA a gagné !* Retentez votre chance.`
                    reply(msg)
                    delete global.db.games[from]
                } else {
                    game.turn = 1 - game.turn
                    reply(`🎮 *MORPION* 🎮\n${renderBoard(game.board)}\n🤖 L'IA a joué.\n👉 Au tour de @${game.players[game.turn].split('@')[0]} (✖️)`, { mentions: [game.players[game.turn]] })
                }
            } else {
                let msg = `🎮 *MORPION* 🎮\n${renderBoard(game.board)}\n👉 Au tour de @${game.players[game.turn].split('@')[0]} (${game.symbols[game.turn]})`
                reply(msg, { mentions: [game.players[game.turn]] })
            }
        }

        const opponent = isAI ? '🤖 IA' : `@${player2Jid.split('@')[0]}`
        reply(`🎮 *DÉBUT DU MORPION* 🎮\n${renderBoard()}\n👤 @${player1.split('@')[0]} (✖️)\n👤 ${opponent} (⭕)\n\n👉 @${player1.split('@')[0]}, tapez un chiffre (1-9) !`, { mentions: [player1, player2Jid] })
    }
}
