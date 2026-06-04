import { getCache, setCache } from './system/cache.js'
import { handleCommand } from './system/router.js'
import { saveMessage, updateUser, updateGroup } from './system/db.js'
import { translateText } from './agent/ai.js'

// LOAD ALL OBSERVERS DYNAMICALLY
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const observers = []
const observerPath = join(__dirname, 'plugins', 'observers')

if (fs.existsSync(observerPath)) {
  const files = fs.readdirSync(observerPath).filter(f => f.endsWith('.js'))
  for (const file of files) {
    try {
      const observer = await import(`./plugins/observers/${file}`)
      if (observer.default) observers.push(observer.default)
    } catch (e) {
      console.log(`[LOADER] Failed to load observer ${file}:`, e.message)
    }
  }
  console.log(`[LOADER] Loaded ${observers.length} observers`)
}

// LANGUAGE DETECTOR + TRANSLATOR
async function getLocalizedText(text, userLang = null) {
  const botLang = getCache('botLanguage') || 'en'
  const targetLang = userLang || botLang

  if (targetLang === 'en' ||!text) return text

  try {
    return await translateText(text, targetLang)
  } catch {
    return text
  }
}

// MAIN LOADER FUNCTION
export function startLoader(sock, db) {
  console.log('[LOADER] Message listener started')

  // MESSAGE UPSERT - KILA MESSAGE INAPITA HAPA
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0]
      if (!msg.message || msg.key.fromMe && getCache('fromMeMode') === 'ignore') return

      // 1. SAVE MESSAGE TO DB/RAM
      await saveMessage(msg)

      // 2. UPDATE USER/GROUP DATA
      const sender = msg.key.remoteJid
      const isGroup = sender.endsWith('@g.us')
      if (isGroup) {
        await updateGroup(sender, msg)
      } else {
        await updateUser(msg.key.participant || sender, msg)
      }

      // 3. RUN OBSERVERS - AUTOREACT, ANTIDELETE, etc
      for (const observer of observers) {
        try {
          await observer(sock, msg, db)
        } catch (e) {
          console.log('[OBSERVER ERROR]:', e.message)
        }
      }

      // 4. EXTRACT MESSAGE DATA
      const mtype = Object.keys(msg.message)[0]
      const body = msg.message.conversation ||
                   msg.message.extendedTextMessage?.text ||
                   msg.message.imageMessage?.caption ||
                   msg.message.videoMessage?.caption || ''

      if (!body) return

      // 5. GET SETTINGS FROM CACHE - HAKUNA HARDCODE
      const prefix = getCache('prefix') || ''
      const botName = getCache('botName') || 'SwiftBot'
      const botLang = getCache('botLanguage') || 'en'
      const publicMode = getCache('publicMode')!== false
      const fromMeMode = getCache('fromMeMode') || 'off'
      const reactions = getCache('reactions')!== false
      const channelLink = getCache('channelLink')!== false

      // 6. CHECK FROMME MODE
      const isOwner = getCache('sudos')?.includes(msg.key.participant || sender)
      if (fromMeMode === 'on' &&!isOwner &&!msg.key.fromMe) return

      // 7. CHECK PUBLIC/PRIVATE MODE
      if (!publicMode &&!isOwner &&!msg.key.fromMe) return

      // 8. PARSE COMMAND - NO PREFIX SUPPORT
      let command = body.trim()
      let args = []

      if (prefix && command.startsWith(prefix)) {
        command = command.slice(prefix.length).trim()
      }

      // Support "menu 1" or "menu" or "1"
      args = command.split(/ +/)
      command = args.shift().toLowerCase()

      // 9. DETECT USER LANGUAGE FROM MESSAGE OR DB
      let userLang = botLang
      try {
        const userData = await db?.collection('users')?.findOne({ jid: msg.key.participant || sender })
        if (userData?.language) userLang = userData.language
      } catch {}

      // 10. SEND TO ROUTER - ROUTER NDIO ANAJUA KAMA COMMAND IPO
      const data = {
        sock,
        msg,
        db,
        body,
        command,
        args,
        sender,
        isGroup,
        isOwner,
        mtype,
        botName,
        botLang,
        userLang,
        reactions,
        channelLink,
        reply: async (text, options = {}) => {
          const translated = await getLocalizedText(text, userLang)
          return sock.sendMessage(sender, { text: translated,...options }, { quoted: msg })
        },
        replyImg: async (url, caption, options = {}) => {
          const translated = await getLocalizedText(caption, userLang)
          return sock.sendMessage(sender, {
            image: { url },
            caption: translated,
           ...options
          }, { quoted: msg })
        }
      }

      // 11. REACT IF ENABLED
      if (reactions && command) {
        try {
          await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } })
        } catch {}
      }

      // 12. HANDLE COMMAND VIA ROUTER
      const handled = await handleCommand(data)

      // 13. REACT SUCCESS/FAIL
      if (reactions && command) {
        try {
          await sock.sendMessage(sender, {
            react: { text: handled? '✅' : '❌', key: msg.key }
          })
        } catch {}
      }

    } catch (e) {
      console.log('[LOADER ERROR]:', e)
    }
  })

  // GROUP PARTICIPANTS UPDATE
  sock.ev.on('group-participants.update', async (update) => {
    try {
      for (const observer of observers) {
        if (observer.type === 'group') {
          await observer(sock, update, db)
        }
      }
    } catch (e) {
      console.log('[GROUP UPDATE ERROR]:', e.message)
    }
  })

  // CONNECTION UPDATE - FOR OBservers
  sock.ev.on('connection.update', async (update) => {
    for (const observer of observers) {
      if (observer.type === 'connection') {
        try {
          await observer(sock, update, db)
        } catch (e) {
          console.log('[CONNECTION OBSERVER ERROR]:', e.message)
        }
      }
    }
  })

  console.log('[LOADER] All events bound successfully')
}