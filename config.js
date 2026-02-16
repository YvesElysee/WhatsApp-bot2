const fs = require('fs')
const path = require('path')

global.owner = ['237999999999'] // Put your number here
global.mods = []
global.prems = []
global.packname = 'WhatsApp Bot'
global.author = 'Bot'

module.exports = {
    SESSION_ID: process.env.SESSION_ID || 'session',
    // Add other config variables here
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(`Update ${__filename}`)
    delete require.cache[file]
    require(file)
})
