import { MongoClient } from 'mongodb'

// RAM FALLBACK STORAGE
const ramDB = {
  settings: new Map(),
  users: new Map(),
  groups: new Map(),
  disabled: new Map(),
  cache: new Map()
}

let mongoClient = null
let mongoDB = null
let useMongo = false

// DEFAULT SETTINGS - HIZI NDIO FALLBACK KAMA DB/RAM HAINA - SIO HARDCODED KWA INDEX.JS
const DEFAULT_SETTINGS = {
  _id: 'global',
  botName: 'SwiftBot',
  prefix: '.', // HII NDIO DEFAULT - UNAWEZA KUBADILISHA NA .setprefix
  botLanguage: 'en',
  publicMode: true,
  fromMeMode: 'off',
  reactions: true,
  channelLink: true,
  autoJoin: [],
  botPic: 'https://i.ibb.co/S7sRhPFq/IMG-20260601-WA0038.jpg',
  disabledCmds: [],
  sudos: [],
  expireData: null,
  welcome: 'on',
  antilink: 'off',
  antibadword: 'off',
  autoread: false,
  autoview: false,
  channelEnabled: false,
  channelJid: '',
  channelName: 'SwiftBot Updates',
  fontStyle: 'normal',
  boxStyle: 1,
  ownerJid: ''
}

// COLLECTIONS ZOTE ZINAZOHITAJIKA
const REQUIRED_COLLECTIONS = ['settings', 'users', 'groups', 'disabled', 'messages']

// CONNECT DATABASE - MONGO AU RAM + AUTO CREATE COLLECTIONS
export async function connectDB(mongoUrl) {
  if (!mongoUrl) {
    console.log('[DB] MONGO_URL not provided. Using RAM Mode')
    useMongo = false
    ramDB.settings.set('global', {...DEFAULT_SETTINGS })
    return null
  }

  try {
    mongoClient = new MongoClient(mongoUrl, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10
    })
    await mongoClient.connect()
    mongoDB = mongoClient.db('swiftbot')
    useMongo = true

    // AUTO CREATE COLLECTIONS KAMA HAZIPO
    for (const colName of REQUIRED_COLLECTIONS) {
      try {
        await mongoDB.createCollection(colName)
        console.log(`[DB] Collection created: ${colName}`)
      } catch (e) {
        // Collection exists already - skip
      }
    }

    // INDEXES ZA SPEED NA UNIQUENESS
    await mongoDB.collection('users').createIndex({ jid: 1 }, { unique: true })
    await mongoDB.collection('groups').createIndex({ jid: 1 }, { unique: true })
    await mongoDB.collection('messages').createIndex({ timestamp: -1 })
    await mongoDB.collection('messages').createIndex({ jid: 1 })
    console.log('[DB] Indexes created')

    // Hakikisha settings zipo
    const settings = await mongoDB.collection('settings').findOne({ _id: 'global' })
    if (!settings) {
      await mongoDB.collection('settings').insertOne(DEFAULT_SETTINGS)
      console.log('[DB] Default settings created in MongoDB')
    }

    return mongoDB
  } catch (e) {
    console.log('[DB] MongoDB connection failed:', e.message)
    console.log('[DB] Falling back to RAM Mode')
    useMongo = false
    ramDB.settings.set('global', {...DEFAULT_SETTINGS })
    return null
  }
}

// CREATE DEFAULT SETTINGS - INAITWA NA INDEX.JS KAMA HAKUNA
export async function createDefaultSettings(defaults, db) {
  try {
    if (useMongo && mongoDB) {
      await mongoDB.collection('settings').updateOne(
        { _id: 'global' },
        { $set: defaults },
        { upsert: true }
      )
      console.log('[DB] Default settings created in MongoDB')
      return defaults
    } else {
      console.log('[DB] RAM Mode - Using default settings in memory')
      ramDB.settings.set('global', {...defaults })
      return defaults
    }
  } catch (e) {
    console.log('[DB] createDefaultSettings error:', e.message)
    ramDB.settings.set('global', {...defaults })
    return defaults
  }
}

// GET SETTINGS - DB AU RAM - SUPER FALLBACK
export async function getSettings() {
  try {
    if (useMongo && mongoDB) {
      const data = await mongoDB.collection('settings').findOne({ _id: 'global' })
      if (!data) {
        console.log('[DB] No settings in Mongo. Creating defaults...')
        await mongoDB.collection('settings').insertOne(DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS
      }
      return {...DEFAULT_SETTINGS, ...data }
    } else {
      const data = ramDB.settings.get('global')
      if (!data) {
        console.log('[DB] No settings in RAM. Creating defaults...')
        ramDB.settings.set('global', {...DEFAULT_SETTINGS })
        return DEFAULT_SETTINGS
      }
      return {...DEFAULT_SETTINGS, ...data }
    }
  } catch (e) {
    console.log('[DB] getSettings error:', e.message)
    return DEFAULT_SETTINGS
  }
}

// UPDATE SETTINGS - DB AU RAM
export async function updateSettings(key, value) {
  try {
    if (useMongo && mongoDB) {
      await mongoDB.collection('settings').updateOne(
        { _id: 'global' },
        { $set: { [key]: value } },
        { upsert: true }
      )
    } else {
      const current = ramDB.settings.get('global') || {...DEFAULT_SETTINGS }
      current[key] = value
      ramDB.settings.set('global', current)
    }
    return true
  } catch (e) {
    console.log('[DB] Update settings failed:', e.message)
    return false
  }
}

// SAVE MESSAGE - DB AU RAM
export async function saveMessage(msg) {
  try {
    const data = {
      jid: msg.key.remoteJid,
      id: msg.key.id,
      from: msg.key.participant || msg.key.remoteJid,
      timestamp: msg.messageTimestamp,
      type: Object.keys(msg.message)[0],
      body: msg.message.conversation || msg.message.extendedTextMessage?.text || ''
    }

    if (useMongo && mongoDB) {
      await mongoDB.collection('messages').insertOne(data)
    } else {
      // RAM: Hifadhi 100 tu za mwisho kuzuia RAM kujaa
      const key = `msg_${msg.key.id}`
      ramDB.cache.set(key, data)
      if (ramDB.cache.size > 100) {
        const firstKey = ramDB.cache.keys().next().value
        ramDB.cache.delete(firstKey)
      }
    }
  } catch {}
}

// UPDATE USER - DB AU RAM
export async function updateUser(jid, msg) {
  try {
    const data = {
      jid,
      name: msg.pushName || 'User',
      lastSeen: Date.now(),
      $inc: { msgCount: 1 }
    }

    if (useMongo && mongoDB) {
      await mongoDB.collection('users').updateOne(
        { jid },
        { $set: { name: data.name, lastSeen: data.lastSeen }, $inc: { msgCount: 1 } },
        { upsert: true }
      )
    } else {
      const user = ramDB.users.get(jid) || { jid, msgCount: 0 }
      user.name = data.name
      user.lastSeen = data.lastSeen
      user.msgCount = (user.msgCount || 0) + 1
      ramDB.users.set(jid, user)
    }
  } catch {}
}

// UPDATE GROUP - DB AU RAM
export async function updateGroup(jid, msg) {
  try {
    const data = {
      jid,
      lastActive: Date.now(),
      $inc: { msgCount: 1 }
    }

    if (useMongo && mongoDB) {
      await mongoDB.collection('groups').updateOne(
        { jid },
        { $set: { lastActive: data.lastActive }, $inc: { msgCount: 1 } },
        { upsert: true }
      )
    } else {
      const group = ramDB.groups.get(jid) || { jid, msgCount: 0 }
      group.lastActive = data.lastActive
      group.msgCount = (group.msgCount || 0) + 1
      ramDB.groups.set(jid, group)
    }
  } catch {}
}

// DISABLE COMMAND - DB AU RAM
export async function disableCmd(cmd) {
  try {
    if (useMongo && mongoDB) {
      await mongoDB.collection('disabled').updateOne(
        { _id: 'cmds' },
        { $addToSet: { list: cmd } },
        { upsert: true }
      )
    } else {
      const current = ramDB.disabled.get('cmds') || []
      if (!current.includes(cmd)) current.push(cmd)
      ramDB.disabled.set('cmds', current)
    }
    return true
  } catch {
    return false
  }
}

// ENABLE COMMAND - DB AU RAM
export async function enableCmd(cmd) {
  try {
    if (useMongo && mongoDB) {
      await mongoDB.collection('disabled').updateOne(
        { _id: 'cmds' },
        { $pull: { list: cmd } }
      )
    } else {
      const current = ramDB.disabled.get('cmds') || []
      const index = current.indexOf(cmd)
      if (index > -1) current.splice(index, 1)
      ramDB.disabled.set('cmds', current)
    }
    return true
  } catch {
    return false
  }
}

// CHECK IF CMD DISABLED - DB AU RAM
export async function isCmdDisabled(cmd) {
  try {
    if (useMongo && mongoDB) {
      const doc = await mongoDB.collection('disabled').findOne({ _id: 'cmds' })
      return doc?.list?.includes(cmd) || false
    } else {
      const current = ramDB.disabled.get('cmds') || []
      return current.includes(cmd)
    }
  } catch {
    return false
  }
}

// GET USER DATA - DB AU RAM
export async function getUser(jid) {
  try {
    if (useMongo && mongoDB) {
      return await mongoDB.collection('users').findOne({ jid })
    } else {
      return ramDB.users.get(jid) || null
    }
  } catch {
    return null
  }
}

// GET GROUP DATA - DB AU RAM
export async function getGroup(jid) {
  try {
    if (useMongo && mongoDB) {
      return await mongoDB.collection('groups').findOne({ jid })
    } else {
      return ramDB.groups.get(jid) || null
    }
  } catch {
    return null
  }
}

// GET DB STATUS - KWA .botdays
export function getDBStatus() {
  return {
    mode: useMongo ? 'MongoDB' : 'RAM',
    ramUsage: useMongo ? 'N/A' : `${ramDB.cache.size} cached msgs, ${ramDB.users.size} users`,
    connected: useMongo
  }
}

// LISTEN SETTINGS UPDATES - KWA MONGO TU
export function listenSettingsUpdates(callback) {
  if (!useMongo || !mongoDB) {
    console.log('[DB] listenSettingsUpdates skipped - RAM mode')
    return
  }
  try {
    const changeStream = mongoDB.collection('settings').watch()
    changeStream.on('change', async () => {
      const newSettings = await getSettings()
      callback(newSettings)
    })
  } catch (e) {
    console.log('[DB] listenSettingsUpdates failed:', e.message)
  }
}

// CLOSE DB
export async function closeDB() {
  if (mongoClient) await mongoClient.close()
}