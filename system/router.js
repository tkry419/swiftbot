import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getCache, setCache } from './cache.js'
import { isCmdDisabled, updateSettings } from './db.js'
import { getBox } from '../theme/box.js'
import { fancyText } from '../theme/fonts.js'
import { translateText } from '../agent/ai.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const commandCache = new Map()
const pluginPath = join(__dirname, '..', 'plugins', 'commands')

function loadCommandList() {
  if (!fs.existsSync(pluginPath)) {
    console.log('[ROUTER] No plugins folder found')
    return
  }
  const files = fs.readdirSync(pluginPath).filter(f => f.endsWith('.js'))
  console.log(`[ROUTER] Found ${files.length} command files`)
}

async function getCommand(cmdName) {
  try {
    if (commandCache.has(cmdName)) return commandCache.get(cmdName)
    const filePath = join(pluginPath, `${cmdName}.js`)
    if (!fs.existsSync(filePath)) return null
    const command = await import(`file://${filePath}?update=${Date.now()}`) // Cache bust
    if (command.default) {
      commandCache.set(cmdName, command.default)
      return command.default
    }
    return null
  } catch (e) {
    console.log(`[ROUTER] Load command ${cmdName} failed:`, e.message)
    return null
  }
}

// GLOBAL FONT WRAPPER - INABADILISHA BOT NZIMA
function applyGlobalFont(text) {
  if (!text) return ''
  const globalFont = getCache('fontStyle') || 'normal'
  if (globalFont === 'normal') return text
  
  // Badilisha kila character kuwa font ya global
  return text.split('').map(char => {
    // Skip special chars, spaces, newlines
    if (char === '\n' || char === ' ' || char === '\t') return char
    if (/[^\w\d]/.test(char) && !/[a-zA-Z0-9]/.test(char)) return char
    return fancyText(char, globalFont)
  }).join('')
}

// TRANSLATE HELPER
async function t(text, userLang) {
  const botLang = getCache('botLanguage') || 'en'
  const targetLang = userLang || botLang
  if (targetLang === 'en' || !text) return text
  if (botLang === 'en' && targetLang === 'en') return text
  try {
    return await translateText(text, targetLang)
  } catch {
    return text
  }
}

// MAIN COMMAND HANDLER
export async function handleCommand(data) {
  const { sock, msg, command, args, isOwner, userLang, sender, isGroup } = data

  if (commandCache.size === 0) loadCommandList()

  const cmd = await getCommand(command)
  if (!cmd) return false

  // REACT FUNCTION - SAFE
  const react = async (emoji) => {
    if (!getCache('reactions')) return
    try {
      await sock.sendMessage(sender, { react: { text: emoji, key: msg.key } })
    } catch {}
  }

  // 1. AUTO REACT FIRST
  await react('⏳')

  // REPLY WRAPPER - GLOBAL FONT + CHANNEL + TRANSLATE
  const reply = async (text) => {
    const translated = await t(text, userLang)
    const finalText = applyGlobalFont(translated)
    const channelContext = {
      contextInfo: {
        externalAdReply: {
          title: applyGlobalFont(getCache('botName') || 'SwiftBot'),
          body: applyGlobalFont('SwiftBot WhatsApp Bot'),
          thumbnailUrl: getCache('botPic'),
          mediaType: 1,
          renderLargerThumbnail: false,
          sourceUrl: getCache('channelLink') || 'https://whatsapp.com'
        }
      }
    }
    return sock.sendMessage(sender, { text: finalText, ...channelContext }, { quoted: msg })
  }

  // REPLYIMG WRAPPER - PIC + CAPTION + CONTEXT
  const replyImg = async (url, caption) => {
    const translated = await t(caption, userLang)
    const finalCaption = applyGlobalFont(translated)
    const channelContext = {
      contextInfo: {
        externalAdReply: {
          title: applyGlobalFont(getCache('botName') || 'SwiftBot'),
          body: applyGlobalFont('SwiftBot WhatsApp Bot'),
          thumbnailUrl: getCache('botPic'),
          mediaType: 1,
          renderLargerThumbnail: false,
          sourceUrl: getCache('channelLink') || 'https://whatsapp.com'
        }
      }
    }
    return sock.sendMessage(sender, {
      image: { url },
      caption: finalCaption,
      ...channelContext
    }, { quoted: msg })
  }

  // 2. CHECK IF DISABLED
  if (await isCmdDisabled(command)) {
    const msg = await t(`Command *${command}* is disabled by owner`, userLang)
    await reply(getBox('error', { text: msg }))
    await react('❌')
    return true
  }

  // 3. CHECK OWNER ONLY
  const sudos = getCache('sudos') || []
  const isSudo = sudos.includes(sender)
  if (cmd.owner && !isOwner && !isSudo) {
    const msg = await t(`Command *${command}* is for owner only`, userLang)
    await reply(getBox('error', { text: msg }))
    await react('❌')
    return true
  }

  // 4. CHECK GROUP/PRIVATE
  if (cmd.group && !isGroup) {
    const msg = await t(`Command *${command}* works in groups only`, userLang)
    await reply(getBox('error', { text: msg }))
    await react('❌')
    return true
  }

  if (cmd.private && isGroup) {
    const msg = await t(`Command *${command}* works in private chat only`, userLang)
    await reply(getBox('error', { text: msg }))
    await react('❌')
    return true
  }

  // 5. GLOBAL DATA - ZOTE ZINAPITA HAPA
  const globalData = {
    ...data,
    reply,
    replyImg,
    react,
    // BOX WRAPPER - FONT AUTOMATIC
    box: (type, data) => getBox(type, data),
    // FONT WRAPPER - GLOBAL DEFAULT
    font: (text, style) => fancyText(text, style || getCache('fontStyle') || 'bold'),
    // TRANSLATE
    t: (text) => t(text, userLang),
    // UPDATE SETTINGS HELPER
    updateSettings: async (key, value) => {
      const result = await updateSettings(key, value)
      if (result) setCache(key, value)
      return result
    },
    settings: {
      botName: getCache('botName') || 'SwiftBot',
      prefix: getCache('prefix') || '',
      botLang: getCache('botLanguage') || 'en',
      publicMode: getCache('publicMode') ?? true,
      fromMeMode: getCache('fromMeMode') || 'off',
      reactions: getCache('reactions') ?? true,
      channelLink: getCache('channelLink') || 'https://whatsapp.com',
      botPic: getCache('botPic') || 'https://i.ibb.co/S7sRhPFq/IMG-20260601-WA0038.jpg',
      autoJoin: getCache('autoJoin') || [],
      sudos: getCache('sudos') || [],
      fontStyle: getCache('fontStyle') || 'normal',
      boxStyle: getCache('boxStyle') || 1
    }
  }

  // 6. RUN COMMAND
  try {
    await cmd.run(globalData)
    await react('✅')
    return true
  } catch (e) {
    console.log(`[ROUTER] Command ${command} error:`, e)
    const msg = await t(`Error running command *${command}*`, userLang)
    await reply(getBox('error', { text: msg, error: e.message }))
    await react('❌')
    return true
  }
}

// GET ALL COMMANDS - KWA .menu
export async function getAllCommands() {
  if (!fs.existsSync(pluginPath)) return []
  const files = fs.readdirSync(pluginPath).filter(f => f.endsWith('.js'))
  const commands = []
  for (const file of files) {
    const cmdName = file.replace('.js', '')
    const cmd = await getCommand(cmdName)
    if (cmd && cmd.name) {
      commands.push({
        name: cmd.name,
        desc: cmd.desc || 'No description',
        category: cmd.category || 'general',
        owner: cmd.owner || false,
        group: cmd.group || false,
        private: cmd.private || false
      })
    }
  }
  return commands
}

// CLEAR COMMAND CACHE - KWA .reload
export function clearCommandCache() {
  commandCache.clear()
  console.log('[ROUTER] Command cache cleared')
}