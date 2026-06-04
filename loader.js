import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getCache } from './system/cache.js'
import { getSettings } from './system/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const observers = []
const observerPath = join(__dirname, 'plugins', 'observers')

// LOAD ALL OBSERVERS DYNAMICALLY - SAFE
if (fs.existsSync(observerPath)) {
  const files = fs.readdirSync(observerPath).filter(f => f.endsWith('.js'))
  for (const file of files) {
    try {
      const observer = await import(`./plugins/observers/${file}`)
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

// MAIN LOADER FUNCTION - NO MESSAGES.UPSERT HERE
export function startLoader(sock, db) {
  console.log('[LOADER] Binding observer events')

  // GROUP PARTICIPANTS UPDATE - WELCOME/GOODBYE/ANTI-PROMOTE/ANTI-DEMOTE
  sock.ev.on('group-participants.update', async (update) => {
    try {
      const settings = await getSettings()
      for (const observer of observers) {
        // Support multiple observer styles
        if (observer.type === 'group' && typeof observer.run === 'function') {
          await observer.run(sock, update, db, settings)
        }
        if (update.action === 'add' && typeof observer.onGroupAdd === 'function') {
          await observer.onGroupAdd({ sock, ...update, db, settings })
        }
        if (update.action === 'remove' && typeof observer.onGroupRemove === 'function') {
          await observer.onGroupRemove({ sock, ...update, db, settings })
        }
        if (update.action === 'promote' && typeof observer.onGroupPromote === 'function') {
          await observer.onGroupPromote({ sock, ...update, db, settings })
        }
        if (update.action === 'demote' && typeof observer.onGroupDemote === 'function') {
          await observer.onGroupDemote({ sock, ...update, db, settings })
        }
      }
    } catch (e) {
      console.log('[GROUP UPDATE ERROR]:', e.message)
    }
  })

  // MESSAGES UPDATE - FOR ANTIDELETE
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

  // CONNECTION UPDATE - FOR OBSERVERS
  sock.ev.on('connection.update', async (update) => {
    for (const observer of observers) {
      if (observer.type === 'connection' && typeof observer.run === 'function') {
        try {
          await observer.run(sock, update, db)
        } catch (e) {
          console.log('[CONNECTION OBSERVER ERROR]:', e.message)
        }
      }
    }
  })

  // CALL EVENTS - FOR ANTI-CALL
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

  // MESSAGES.REACTION - FOR AUTOREACT
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

  console.log('[LOADER] All observer events bound successfully')
}