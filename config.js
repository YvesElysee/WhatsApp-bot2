require('dotenv').config()
const fs = require('fs')
const path = require('path')

global.owner = ['237697353272'] // Put your number here
global.mods = []
global.prems = []
global.packname = 'Ely Bot'
global.author = 'Elysée'

module.exports = {
    SESSION_ID: process.env.SESSION_ID || 'session',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || process.env.API_KEY || 'sk-proj-...' // Supports both common names
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(`Update ${__filename}`)
    delete require.cache[file]
    require(file)
})
