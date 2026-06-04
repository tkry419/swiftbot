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
import { connectDB, getSettings, isCmdDisabled } from './system/db.js'
import { initCache, setCache, getCache } from './system/cache.js'
import { getBox } from './theme/box.js'
import { fancyText } from './theme/fonts.js'
import { loadCommandList, handleCommand } from './system/router.js' // DIRECT IMPORT

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// === DYNAMIC OBSERVER LOADER ===
const observers = []
const observerPath = join(__dirname, 'plugins', 'observers')

if (fs.existsSync(observerPath)) {
  const files = fs.readdirSync(observerPath).filter(f => f.endsWith('.js'))
  for (const file of files) {
    try {
      const observer = await import(`file://${join(observerPath, file)}`)
      if (observer.default) {
        observers.push(observer.default)
        console.log(`[LOADER] Loaded observer: ${file}`)
      }
    } catch (e) {
      console.log(`[LOADER] Failed to load observer ${file}:`, e.message)
    }
  }
  console.log(`[LOADER] Loaded ${observers.length} observers total`)
} else {
  console.log('[LOADER] No observers folder found at plugins/observers/')
}

// ENV CONFIG - ONLY THESE 3 ARE ALLOWED FROM ENV
const SESSION_ID = process.env.SESSION_ID
const MONGO_URL = process.env.MONGO_URL || null
const EXPIRE_DATA = process.env.EXPIRE_DATA || null
const PORT = process.env.PORT || 3000

// DEFAULTS - NO HARDCODE, COMES FROM DB/RAM
const DEFAULT_BOT_PIC = 'https://i.ibb.co/S7sRhPFq/IMG-20260601-WA0038.jpg'
const DEFAULT_BOT_NAME = 'SwiftBot'
const DEFAULT_AUTO_JOIN = []

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

  // 5. CREATE SOCKET
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

  // === 7. ALL EVENTS HANDLED HERE - NO LOADER.JS NEEDED ===

  // 7A. MESSAGES.UPSERT - COMMANDS + OBSERVERS - NO FROMME BLOCK
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0]
      if (!msg.message) return

      const sender = msg.key.remoteJid
      const isGroup = sender.endsWith('@g.us')
      const body = msg.message.conversation ||
                   msg.message.extendedTextMessage?.text ||
                   msg.message.imageMessage?.caption ||
                   msg.message.videoMessage?.caption || ''

      // RUN OBSERVERS onMessage FIRST - NO FROM ME BLOCK
      for (const observer of observers) {
        if (typeof observer.onMessage === 'function') {
          try {
            await observer.onMessage({ sock, msg, sender, isGroup, db })
          } catch (e) {
            console.log(`[OBSERVER ERROR] onMessage:`, e.message)
          }
        }
      }

      // CHECK PREFIX
      const prefix = getCache('prefix') || '.'
      if (!body.startsWith(prefix)) return

      // PARSE COMMAND - FULL POWERS
      const args = body.slice(prefix.length).trim().split(/ +/)
      const command = args.shift().toLowerCase()
      const senderNum = (msg.key.participant || sender).split('@')[0]
      const sudos = getCache('sudos') || []
      const ownerJid = getCache('ownerJid') || sock.user.id
      const ownerNum = ownerJid.split('@')[0]
      const isOwner = senderNum === ownerNum || sudos.includes(senderNum)

      console.log(`[CORE] Command: ${command} from ${senderNum} | Owner: ${isOwner} | Group: ${isGroup}`)

      // CALL ROUTER WITH FULL AUTHORITY
      await handleCommand({
        sock,
        msg,
        command,
        args,
        sender,
        isGroup,
        isOwner,
        userLang: getCache('botLanguage') || 'en',
        db // FULL DB ACCESS
      })

    } catch (e) {
      console.log('[CORE] Message handler error:', e.message)
    }
  })

  // 7B. GROUP PARTICIPANTS UPDATE
  sock.ev.on('group-participants.update', async (update) => {
    try {
      const settings = await getSettings()
      for (const observer of observers) {
        if (observer.type === 'group' && typeof observer.run === 'function') {
          await observer.run(sock, update, db, settings)
        }
        if (update.action === 'add' && typeof observer.onGroupAdd === 'function') {
          await observer.onGroupAdd({ sock,...update, db, settings })
        }
        if (update.action === 'remove' && typeof observer.onGroupRemove === 'function') {
          await observer.onGroupRemove({ sock,...update, db, settings })
        }
        if (update.action === 'promote' && typeof observer.onGroupPromote === 'function') {
          await observer.onGroupPromote({ sock,...update, db, settings })
        }
        if (update.action === 'demote' && typeof observer.onGroupDemote === 'function') {
          await observer.onGroupDemote({ sock,...update, db, settings })
        }
      }
    } catch (e) {
      console.log('[GROUP UPDATE ERROR]:', e.message)
    }
  })

  // 7C. MESSAGES UPDATE - ANTIDELETE
  sock.ev.on('messages.update', async (updates) => {
    try {
      const settings = await getSettings()
      for (const update of updates) {
        for (const observer of observers) {
          if (typeof observer.onMessageUpdate === 'function') {
            await observer.onMessageUpdate({ sock, update, db, settings, getCache })
          }
        }
      }
    } catch (e) {
      console.log('[MESSAGE UPDATE ERROR]:', e.message)
    }
  })

  // 7D. CONNECTION UPDATE - OBSERVERS + BOT STARTUP
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

    // Run connection observers
    for (const observer of observers) {
      if (observer.type === 'connection' && typeof observer.run === 'function') {
        try {
          await observer.run(sock, update, db)
        } catch (e) {
          console.log('[CONNECTION OBSERVER ERROR]:', e.message)
        }
      }
    }

    if (connection === 'open') {
      console.log('[WA] Connected successfully as', sock.user?.name || sock.user?.id)
      console.log('[WA] Repo 1 connection should be terminated now')

      // Load settings from DB/RAM to cache
      const settings = await getSettings()
      const botName = settings?.botName || DEFAULT_BOT_NAME
      const autoJoin = settings?.autoJoin || DEFAULT_AUTO_JOIN
      const botPic = settings?.botPic || DEFAULT_BOT_PIC

      setCache('botName', botName)
      setCache('autoJoin', autoJoin)
      setCache('botPic', botPic)
      setCache('ownerJid', sock.user.id) // SET OWNER JID

      if (settings) {
        Object.keys(settings).forEach(key => setCache(key, settings[key]))
        console.log('[CACHE] Settings loaded from DB/RAM')
      }

      // LOAD COMMANDS ON STARTUP - BANNER
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

      // SEND CONNECTED MESSAGE
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

      console.log('[CORE] All events bound successfully')
      console.log('[CORE] Message listener started')
      console.log('[CORE] Bot ready - NO FROMME BLOCK')
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log('[WA] Connection closed. Reason:', reason)

      if (reason === DisconnectReason.connectionReplaced) {
        console.log('[WA] Session opened on another server. Yielding to prevent ban.')
        process.exit(0)
      }

      if (reason === DisconnectReason.loggedOut) {
        console.log('[WA] Logged out. Delete SESSION_ID and regenerate.')
        fs.rmSync(SESSION_DIR, { recursive: true, force: true })
        process.exit(0)
      }

      console.log('[WA] Reconnecting in 5s...')
      setTimeout(() => startBot(), 5000)
    }
  })

  // 7E. CALL EVENTS - ANTI-CALL
  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      for (const observer of observers) {
        if (observer.type === 'call' && typeof observer.run === 'function') {
          try {
            await observer.run(sock, call, db)
          } catch (e) {
            console.log('[CALL OBSERVER ERROR]:', e.message)
          }
        }
      }
    }
  })

  // 7F. MESSAGES.REACTION - AUTOREACT
  sock.ev.on('messages.reaction', async (reactions) => {
    for (const reaction of reactions) {
      for (const observer of observers) {
        if (observer.type === 'reaction' && typeof observer.run === 'function') {
          try {
            await observer.run(sock, reaction, db)
          } catch (e) {
            console.log('[REACTION OBSERVER ERROR]:', e.message)
          }
        }
      }
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