module.exports = {
    // Messages de l'IA pour lesquels on veut répondre aux replies
    addAIReply: (chatId, msgKeyId, threadId) => {
        if (!global.db.aiReplyCache) global.db.aiReplyCache = {}
        if (!global.db.aiReplyCache[chatId]) global.db.aiReplyCache[chatId] = new Map()
        global.db.aiReplyCache[chatId].set(msgKeyId, { threadId, ts: Date.now() })
        // Nettoyer vieux
        const now = Date.now()
        for (const [k, v] of global.db.aiReplyCache[chatId]) {
            if (now - v.ts > 30 * 60 * 1000) global.db.aiReplyCache[chatId].delete(k)
        }
    },
    isReplyToAI: (chatId, quotedId) => {
        if (!global.db.aiReplyCache?.[chatId]) return false
        return global.db.aiReplyCache[chatId].has(quotedId)
    }
}
