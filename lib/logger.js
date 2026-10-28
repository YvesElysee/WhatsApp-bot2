const fs = require('fs')
const path = require('path')

const LOG_DIR = path.join(__dirname, '../logs')
if (!fs.existsSync(LOG_DIR)) {
    try { fs.mkdirSync(LOG_DIR, { recursive: true }) } catch (e) {}
}

const getLogFile = () => {
    const d = new Date()
    const name = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.log`
    return path.join(LOG_DIR, name)
}

const log = (level, msg, meta = {}) => {
    const entry = {
        ts: new Date().toISOString(),
        level,
        msg,
        ...meta
    }
    const line = JSON.stringify(entry)
    try {
        fs.appendFileSync(getLogFile(), line + '\n')
    } catch (e) {}
    const prefix = level === 'error' ? '[ERR]' : level === 'warn' ? '[WARN]' : '[INFO]'
    console.log(`${prefix} ${msg}`)
}

module.exports = {
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    debug: (msg, meta) => log('debug', msg, meta)
}
