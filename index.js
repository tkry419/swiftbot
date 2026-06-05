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
import { connectDB, getSettings, isCmdDisabled, createDefaultSettings } from './system/db.js'
import { initCache, setCache, getCache } from './system/cache.js'
import { getBox } from './theme/box.js'
import { fancyText } from './theme/fonts.js'
import { loadCommandList, handleCommand } from './system/router.js'

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

// DEFAULTS - ZITAWEKWA DB/RAM KAMA HAZIPO - SIO HARDCODED KILA MAHALI
const DEFAULT_SETTINGS = {
  _id: 'main',
  botName: 'SwiftBot',
  prefix: '.',
  botPic: 'https://i.ibb.co/S7sRhPFq/IMG-20260601-WA0038.jpg',
  botLanguage: 'en',
  autoJoin: [],
  sudos: [],
  fontStyle: 'normal',
  boxStyle: 1,
  reactions: true,
  publicMode: true,
  fromMeMode: 'off',
  channelEnabled: false,
  channelJid: '',
  channelName: 'SwiftBot Updates',
  channelLink: 'https://whatsapp.com',
  ownerJid: '',
  disabledCmds: []
}

// GLOBAL SETTINGS - FROM MONGO/RAM ONLY
let botSettings = null
let db = null

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

// 10 WAYS FORCE COMMAND PARSER - EACH WITH TRY-CATCH
async function parseCommand10Ways(msg, sender, isGroup, sock) {
  const bodies = []

  // WAY 1: conversation
  try { bodies.push({ way: 1, body: msg.message?.conversation || '' }) } catch (e) { bodies.push({ way: 1, error: e.message }) }

  // WAY 2: extendedTextMessage
  try { bodies.push({ way: 2, body: msg.message?.extendedTextMessage?.text || '' }) } catch (e) { bodies.push({ way: 2, error: e.message }) }

  // WAY 3: imageMessage caption
  try { bodies.push({ way: 3, body: msg.message?.imageMessage?.caption || '' }) } catch (e) { bodies.push({ way: 3, error: e.message }) }

  // WAY 4: videoMessage caption
  try { bodies.push({ way: 4, body: msg.message?.videoMessage?.caption || '' }) } catch (e) { bodies.push({ way: 4, error: e.message }) }

  // WAY 5: documentMessage caption
  try { bodies.push({ way: 5, body: msg.message?.documentMessage?.caption || '' }) } catch (e) { bodies.push({ way: 5, error: e.message }) }

  // WAY 6: buttonsResponseMessage
  try { bodies.push({ way: 6, body: msg.message?.buttonsResponseMessage?.selectedButtonId || '' }) } catch (e) { bodies.push({ way: 6, error: e.message }) }

  // WAY 7: templateButtonReplyMessage
  try { bodies.push({ way: 7, body: msg.message?.templateButtonReplyMessage?.selectedId || '' }) } catch (e) { bodies.push({ way: 7, error: e.message }) }

  // WAY 8: listResponseMessage
  try { bodies.push({ way: 8, body: msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId || '' }) } catch (e) { bodies.push({ way: 8, error: e.message }) }

  // WAY 9: reactionMessage text
  try { bodies.push({ way: 9, body: msg.message?.reactionMessage?.text || '' }) } catch (e) { bodies.push({ way: 9, error: e.message }) }

  // WAY 10: quoted message conversation
  try { bodies.push({ way: 10, body: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || '' }) } catch (e) { bodies.push({ way: 10, error: e.message }) }

  // FIND FIRST VALID BODY
  let body = ''
  let usedWay = 0
  for (const result of bodies) {
    if (result.body && result.body.trim().length > 0) {
      body = result.body
      usedWay = result.way
      break
    }
  }

  if (!body) return null

  const prefix = getCache('prefix')
  if (!prefix) {
    console.log('[FORCE] Prefix not loaded from DB yet')
    return null
  }

  if (!body.startsWith(prefix)) {
    console.log(`[FORCE-WAY-${usedWay}] No prefix match. Body:"${body}" Expected:"${prefix}"`)
    return null
  }

  const args = body.slice(prefix.length).trim().split(/ +/)
  const command = args.shift().toLowerCase()
  const senderNum = (msg.key.participant || sender).split('@')[0]
  const sudos = getCache('sudos') || []
  const ownerJid = getCache('ownerJid') || sock.user.id
  const ownerNum = ownerJid.split('@')[0]
  const isOwner = senderNum === ownerNum || sudos.includes(senderNum)

  console.log(`[FORCE-WAY-${usedWay}] Command: ${command} from ${senderNum} | Owner: ${isOwner} | Group: ${isGroup}`)

  return {
    command,
    args,
    sender,
    isGroup,
    isOwner,
    userLang: getCache('botLanguage') || 'en',
    db
  }
}

// MAIN START FUNCTION
async function startBot() {
  console.log(`==> SwiftBot starting...`)
  console.log(`==> Baileys: 6.7.22 | Mode: Dynamic | Platform: ${detectPlatform()}`)

  // 1. CHECK EXPIRE
  if (!checkExpire()) process.exit(0)

  // 2. CONNECT DATABASE - MONGO ONLY
  db = await connectDB(MONGO_URL)
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

  // 4. LOAD SETTINGS FROM MONGO/RAM - CREATE DEFAULTS IF MISSING
  botSettings = await getSettings()

  // AUTO-CREATE DEFAULTS KAMA HAZIPO - HII SIO HARDCODE, NI AUTO-INIT
  if (!botSettings) {
    console.log('[DB] No settings found. Creating default settings...')
    botSettings = await createDefaultSettings(DEFAULT_SETTINGS, db)
    if (!botSettings) {
      console.error('[FATAL] Failed to create default settings')
      process.exit(1)
    }
  }

  // VALIDATE CRITICAL FIELDS - TUMIA DEFAULT KAMA HAZIPO
  if (!botSettings.prefix) {
    console.log('[DB] Prefix missing. Setting default prefix from DEFAULT_SETTINGS...')
    botSettings.prefix = DEFAULT_SETTINGS.prefix
    if (db) await updateSettings('prefix', DEFAULT_SETTINGS.prefix)
  }

  botSettings.db = db // ATTACH DB TO SETTINGS

  // 5. LOAD TO CACHE
  Object.keys(botSettings).forEach(key => setCache(key, botSettings[key]))
  console.log('[CACHE] Settings loaded from DB/RAM. Prefix:', getCache('prefix'))

  // 6. LOAD COMMANDS
  loadCommandList()

  listenSettingsUpdates((newSettings) => {
    botSettings = newSettings
    botSettings.db = db
    Object.keys(newSettings).forEach(key => setCache(key, newSettings[key]))
    console.log('🔥 Live settings sync. Prefix:', newSettings.prefix)
  })

  await connectToWhatsApp()
}

async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
    const { version } = await fetchLatestBaileysVersion()
    console.log(`[WA] Using WA v${version.join('.')}`)

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
      syncFullHistory: false,
      emitOwnEvents: true // HII NI MUHIMU KWA COMMANDS ZA OWNER
    })

    sock.ev.on('creds.update', saveCreds)

    // MESSAGES.UPSERT - USING 10 WAYS PARSER
    sock.ev.on('messages.upsert', async (m) => {
      try {
        if (!botSettings ||!getCache('prefix')) {
          console.log('⚠️ Settings not ready. Ignoring message.')
          return
        }

        const msg = m.messages[0]
        if (!msg.message) return

        const sender = msg.key.remoteJid
        const isGroup = sender.endsWith('@g.us')

        // RUN OBSERVERS
        for (const observer of observers) {
          if (typeof observer.onMessage === 'function') {
            try {
              await observer.onMessage({ sock, msg, sender, isGroup, db: botSettings.db })
            } catch (e) {
              console.log(`[OBSERVER ERROR] onMessage:`, e.message)
            }
          }
        }

        // 10 WAYS FORCE PARSE
        const cmdData = await parseCommand10Ways(msg, sender, isGroup, sock)
        if (!cmdData) return

        await handleCommand({ sock, msg,...cmdData })

      } catch (e) {
        console.log(' Message handler error:', e.message)
      }
    })

    // GROUP PARTICIPANTS UPDATE
    sock.ev.on('group-participants.update', async (update) => {
      try {
        const settings = await getSettings()
        for (const observer of observers) {
          if (observer.type === 'group' && typeof observer.run === 'function') {
            await observer.run(sock, update, botSettings.db, settings)
          }
          if (update.action === 'add' && typeof observer.onGroupAdd === 'function') {
            await observer.onGroupAdd({ sock,...update, db: botSettings.db, settings })
          }
          if (update.action === 'remove' && typeof observer.onGroupRemove === 'function') {
            await observer.onGroupRemove({ sock,...update, db: botSettings.db, settings })
          }
          if (update.action === 'promote' && typeof observer.onGroupPromote === 'function') {
            await observer.onGroupPromote({ sock,...update, db: botSettings.db, settings })
          }
          if (update.action === 'demote' && typeof observer.onGroupDemote === 'function') {
            await observer.onGroupDemote({ sock,...update, db: botSettings.db, settings })
          }
        }
      } catch (e) {
        console.log('[GROUP UPDATE ERROR]:', e.message)
      }
    })

    // MESSAGES UPDATE - ANTIDELETE
    sock.ev.on('messages.update', async (updates) => {
      try {
        const settings = await getSettings()
        for (const update of updates) {
          for (const observer of observers) {
            if (typeof observer.onMessageUpdate === 'function') {
              await observer.onMessageUpdate({ sock, update, db: botSettings.db, settings, getCache })
            }
          }
        }
      } catch (e) {
        console.log('[MESSAGE UPDATE ERROR]:', e.message)
      }
    })

    // CONNECTION UPDATE
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update

      for (const observer of observers) {
        if (observer.type === 'connection' && typeof observer.run === 'function') {
          try {
            await observer.run(sock, update, botSettings.db)
          } catch (e) {
            console.log('[CONNECTION OBSERVER ERROR]:', e.message)
          }
        }
      }

      if (connection === 'open') {
        console.log('[WA] Connected successfully as', sock.user?.name || sock.user?.id)
        setCache('ownerJid', sock.user.id)

        const botName = getCache('botName')
        const autoJoin = getCache('autoJoin') || []
        const botPic = getCache('botPic')

        if (autoJoin.length > 0) {
          for (const jid of autoJoin) {
            try {
              if (jid.includes('@newsletter')) {
                await sock.newsletterFollow(jid)
                console.log(` Joined channel: ${jid}`)
              } else if (jid.includes('@g.us')) {
                await sock.groupAcceptInvite(jid)
                console.log(` Joined group: ${jid}`)
              }
            } catch (e) {
              console.log(` Failed to join ${jid}:`, e.message)
            }
            await new Promise(r => setTimeout(r, 2000))
          }
        }

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

        console.log(' All events bound successfully')
        console.log(' Bot ready - NO FROMME BLOCK')
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

    // CALL EVENTS
    sock.ev.on('call', async (calls) => {
      for (const call of calls) {
        for (const observer of observers) {
          if (observer.type === 'call' && typeof observer.run === 'function') {
            try {
              await observer.run(sock, call, botSettings.db)
            } catch (e) {
              console.log('[CALL OBSERVER ERROR]:', e.message)
            }
          }
        }
      }
    })

    // MESSAGES.REACTION
    sock.ev.on('messages.reaction', async (reactions) => {
      for (const reaction of reactions) {
        for (const observer of observers) {
          if (observer.type === 'reaction' && typeof observer.run === 'function') {
            try {
              await observer.run(sock, reaction, botSettings.db)
            } catch (e) {
              console.log('[REACTION OBSERVER ERROR]:', e.message)
            }
          }
        }
      }
    })

  } catch (err) {
    console.error('Fatal connection error:', err.message)
    setTimeout(() => startBot(), 15000)
  }
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