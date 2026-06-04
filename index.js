import 'dotenv/config'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pino from 'pino'
import fs from 'fs'
import express from 'express'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'

// Import internal systems
import { connectDB, getSettings } from './system/db.js'
import { initCache, setCache, getCache } from './system/cache.js'
import { startLoader } from './loader.js'
import { getBox } from './theme/box.js'
import { fancyText } from './theme/fonts.js'
import { loadCommandList } from './system/router.js' // IMPORT ROUTER LOADER

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// SAFE OBSERVER LOADER - IF NOT EXISTS SKIP WITHOUT ERROR
async function loadObserver(name) {
  try {
    const observerPath = join(__dirname, 'plugins', 'observers', `${name}.js`)
    if (!fs.existsSync(observerPath)) {
      console.log(`[OBSERVER] ${name}.js not found, skipping`)
      return null
    }
    const module = await import(`file://${observerPath}`)
    console.log(`[LOADER] Loaded observer: ${name}.js`)
    return module.default || null
  } catch (e) {
    console.log(`[OBSERVER] Failed to load ${name}:`, e.message)
    return null
  }
}

const antideleteObserver = await loadObserver('antidelete')
const welcomeObserver = await loadObserver('welcome')
const goodbyeObserver = await loadObserver('goodbye')
const antipromoteObserver = await loadObserver('antipromote')
const antidemoteObserver = await loadObserver('antidemote')

console.log(`[LOADER] Loaded ${[antideleteObserver, welcomeObserver, goodbyeObserver, antipromoteObserver, antidemoteObserver].filter(Boolean).length} observers total`)

// ENV CONFIG - ONLY THESE 3 ARE ALLOWED FROM ENV
const SESSION_ID = process.env.SESSION_ID
const MONGO_URL = process.env.MONGO_URL || null
const EXPIRE_DATA = process.env.EXPIRE_DATA || null
const PORT = process.env.PORT || 3000

// DEFAULTS - NO HARDCODE, COMES FROM DB/RAM
const DEFAULT_BOT_PIC = 'https://i.ibb.co/S7sRhPFq/IMG-20260601-WA0038.jpg'
const DEFAULT_BOT_NAME = 'SwiftBot'
const DEFAULT_AUTO_JOIN = [] // Add JIDs of groups/channels here: ['123@g.us', '123@newsletter']

// VALIDATE SESSION_ID
if (!SESSION_ID ||!SESSION_ID.startsWith('SWIFTBOT~')) {
  console.error('[FATAL] SESSION_ID missing or invalid. Use SWIFTBOT~ format from Repo 1')
  process.exit(1)
}

// DECODE SESSION_ID TO CREDS
function decodeSessionId(sessionId) {
  try {
    const base64 = sessionId.replace('SWIFTBOT~', '')
    const jsonString = Buffer.from(base64, 'base64').toString('utf-8')
    return JSON.parse(jsonString)
  } catch (e) {
    console.error('[FATAL] Failed to decode SESSION_ID:', e.message)
    process.exit(1)
  }
}

const decodedCreds = decodeSessionId(SESSION_ID)
const SESSION_DIR = join(__dirname, 'sessions', 'main')

// Write creds to file for Baileys 6.7.22
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true })
}
fs.writeFileSync(join(SESSION_DIR, 'creds.json'), JSON.stringify(decodedCreds, null, 2))

// DETECT HOST PLATFORM
function detectPlatform() {
  if (process.env.RENDER) return 'Render'
  if (process.env.RAILWAY_ENVIRONMENT) return 'Railway'
  if (process.env.DYNO) return 'Heroku'
  if (process.env.KOYEB) return 'Koyeb'
  if (process.env.REPL_ID) return 'Replit'
  return 'Local/Panel'
}

// EXPIRE CHECK
function checkExpire() {
  if (!EXPIRE_DATA) return true

  const now = Date.now()
  let expireTime = 0

  if (EXPIRE_DATA.includes('D')) {
    const days = parseInt(EXPIRE_DATA.replace('D', ''))
    const startTime = decodedCreds.lastAccountSyncTimestamp || now
    expireTime = startTime + (days * 24 * 60 * 60 * 1000)
  } else if (EXPIRE_DATA.includes('-')) {
    expireTime = new Date(EXPIRE_DATA).getTime()
  }

  if (expireTime && now > expireTime) {
    console.error('[EXPIRE] Bot expired. Contact owner to renew.')
    return false
  }
  return true
}

// EXPRESS SERVER FOR RENDER PORT BINDING
const app = express()
app.get('/', (req, res) => {
  res.send('SwiftBot is running ✅')
})

app.listen(PORT, () => {
  console.log(`[SERVER] Port ${PORT} opened for Render`)
})

// MAIN START FUNCTION
async function startBot() {
  console.log(`==> SwiftBot starting...`)
  console.log(`==> Baileys: 6.7.22 | Mode: Dynamic | Platform: ${detectPlatform()}`)

  // 1. CHECK EXPIRE
  if (!checkExpire()) process.exit(0)

  // 2. CONNECT DATABASE - RAM FALLBACK AUTOMATIC
  const db = await connectDB(MONGO_URL)
  if (db) {
    console.log('[DB] MongoDB connected')
  } else {
    console.log('[DB] MONGO_URL not provided. Using RAM Mode')
    console.log('[DB] RAM Mode: Data will reset on restart - Auto controlled')
  }

  // 3. INIT CACHE
  await initCache()
  setCache('startTime', Date.now())
  setCache('platform', detectPlatform())
  setCache('expireData', EXPIRE_DATA)
  console.log('[CACHE] Initialized')

  // 4. LOAD BAILEYS AUTH
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const { version } = await fetchLatestBaileysVersion()
  console.log(`[WA] Using WA v${version.join('.')}`)

  // 5. CREATE SOCKET - SAME LOGIC AS REPO 1
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    markOnlineOnConnect: true,
    defaultQueryTimeoutMs: 60000,
    syncFullHistory: false
  })

  // 6. CREDS UPDATE
  sock.ev.on('creds.update', saveCreds)

  // 7. CONNECTION HANDLER - SAME AS REPO 1
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'open') {
      console.log('[WA] Connected successfully as', sock.user?.name || sock.user?.id)
      console.log('[WA] Repo 1 connection should be terminated now')

      // Load settings from DB/RAM to cache - BOTNAME and all come from here
      const settings = await getSettings()
      const botName = settings?.botName || DEFAULT_BOT_NAME
      const autoJoin = settings?.autoJoin || DEFAULT_AUTO_JOIN
      const botPic = settings?.botPic || DEFAULT_BOT_PIC

      setCache('botName', botName)
      setCache('autoJoin', autoJoin)
      setCache('botPic', botPic)

      if (settings) {
        Object.keys(settings).forEach(key => setCache(key, settings[key]))
        console.log('[CACHE] Settings loaded from DB/RAM')
      }

      // === LOAD COMMANDS ON STARTUP - HII NDO INATOA BANNER ===
      loadCommandList()

      // AUTO JOIN GROUPS/CHANNELS
      if (autoJoin.length > 0) {
        for (const jid of autoJoin) {
          try {
            if (jid.includes('@newsletter')) {
              await sock.newsletterFollow(jid)
              console.log(`[AUTO] Joined channel: ${jid}`)
            } else if (jid.includes('@g.us')) {
              await sock.groupAcceptInvite(jid)
              console.log(`[AUTO] Joined group: ${jid}`)
            }
          } catch (e) {
            console.log(`[AUTO] Failed to join ${jid}:`, e.message)
          }
          await new Promise(r => setTimeout(r, 2000))
        }
      }

      // SEND CONNECTED MESSAGE - WITH BOX + PIC + DYNAMIC DATA
      try {
        const uptime = Math.floor(process.uptime())
        const connectMsg = getBox('connect', {
          botName: fancyText(botName, 'bold'),
          platform: detectPlatform(),
          user: sock.user?.name || 'User',
          number: sock.user?.id?.split(':')[0] || 'Unknown',
          uptime: `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`,
          mode: MONGO_URL? 'Database' : 'RAM Mode'
        })

        await sock.sendMessage(sock.user.id, {
          image: { url: botPic },
          caption: connectMsg,
          contextInfo: { forwardingScore: 999, isForwarded: true }
        })
        console.log('[WA] Connected message sent to owner')
      } catch (e) {
        console.log('[WA] Failed to send connect message:', e.message)
      }

      // Start loader - handles additional events including messages.upsert
      console.log('[LOADER] Binding observer events')
      startLoader(sock, db)
      console.log('[LOADER] All observer events bound successfully')
      console.log('[LOADER] Message listener started')
      console.log('[LOADER] All events bound successfully')
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log('[WA] Connection closed. Reason:', reason)

      // CRITICAL: REPO 1 LOGIC - YIELD IF NEW SERVER CONNECTS
      if (reason === DisconnectReason.connectionReplaced) {
        console.log('[WA] Session opened on another server. Yielding to prevent ban.')
        process.exit(0)
      }

      // LOGGED OUT - EXIT
      if (reason === DisconnectReason.loggedOut) {
        console.log('[WA] Logged out. Delete SESSION_ID and regenerate.')
        fs.rmSync(SESSION_DIR, { recursive: true, force: true })
        process.exit(0)
      }

      // OTHER ERRORS - RECONNECT
      console.log('[WA] Reconnecting in 5s...')
      setTimeout(() => startBot(), 5000)
    }
  })
}

// GRACEFUL SHUTDOWN
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received. Shutting down...')
  process.exit(0)
})

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err)
})

startBot()