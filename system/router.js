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

// ASCII BANNER HELPER
function printBanner() {
  const botName = getCache('botName') || 'SwiftBot'
  const border = '='.repeat(botName.length + 12)
  console.log('\n' + border)
  console.log(` ${botName.toUpperCase()} ROUTER`)
  console.log(border + '\n')
}

// RECURSIVE SCAN - SUPPORTS SUBFOLDERS
function scanCommands(dir) {
  const results = []
  if (!fs.existsSync(dir)) return results

  const items = fs.readdirSync(dir, { withFileTypes: true })

  for (const item of items) {
    const fullPath = join(dir, item.name)

    if (item.isDirectory()) {
      // Recursively scan subfolders: general/, owner/, settings/
      results.push(...scanCommands(fullPath))
    } else if (item.isFile() && item.name.endsWith('.js')) {
      // Extract command name from file path
      const relativePath = fullPath.replace(pluginPath + '/', '').replace('.js', '')
      results.push({ name: relativePath, path: fullPath })
    }
  }
  return results
}

function loadCommandList() {
  if (!fs.existsSync(pluginPath)) {
    console.log('[ROUTER] Error: No plugins folder found at', pluginPath)
    return
  }

  printBanner()
  const commands = scanCommands(pluginPath)

  if (commands.length === 0) {
    console.log('[ROUTER] Warning: No command files found')
    return
  }

  console.log(`[ROUTER] Discovered ${commands.length} command modules`)
  console.log('[ROUTER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Log each command with category grouping
  const grouped = {}
  commands.forEach(cmd => {
    const category = cmd.name.split('/')[0] || 'root'
    if (!grouped[category]) grouped[category] = []
    grouped[category].push(cmd.name)
  })

  Object.keys(grouped).sort().forEach(cat => {
    console.log(`[ROUTER] [${cat.toUpperCase()}]`)
    grouped[cat].forEach(cmdName => {
      console.log(`[ROUTER] • ${cmdName}`)
    })
  })

  console.log('[ROUTER] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('[ROUTER] Command registry initialized\n')
}

async function getCommand(cmdName) {
  try {
    if (commandCache.has(cmdName)) {
      console.log(`[ROUTER] Cache Hit: ${cmdName}`)
      return commandCache.get(cmdName)
    }

    // Search in all subfolders: general/menu.js, owner/eval.js, etc
    const allCommands = scanCommands(pluginPath)
    const cmdFile = allCommands.find(c => c.name === cmdName || c.name.endsWith(`/${cmdName}`))

    if (!cmdFile) {
      console.log(`[ROUTER] Command Not Found: ${cmdName}`)
      return null
    }

    const command = await import(`file://${cmdFile.path}?update=${Date.now()}`) // Cache bust
    if (command.default) {
      commandCache.set(cmdName, command.default)
      console.log(`[ROUTER] Loaded: ${cmdName} → ${cmdFile.name}`)
      return command.default
    }
    return null
  } catch (e) {
    console.log(`[ROUTER] Load Failed [${cmdName}]: ${e.message}`)
    return null
  }
}

// GLOBAL FONT WRAPPER - APPLIES TO ENTIRE BOT
function applyGlobalFont(text) {
  if (!text) return ''
  const globalFont = getCache('fontStyle') || 'normal'
  if (globalFont === 'normal') return text

  // Convert each character to global font style
  return text.split('').map(char => {
    // Skip special chars, spaces, newlines
    if (char === '\n' || char === ' ' || char === '\t') return char
    if (/[^\w\d]/.test(char) &&!/[a-zA-Z0-9]/.test(char)) return char
    return fancyText(char, globalFont)
  }).join('')
}

// TRANSLATE HELPER
async function t(text, userLang) {
  const botLang = getCache('botLanguage') || 'en'
  const targetLang = userLang || botLang
  if (targetLang === 'en' ||!text) return text
  if (botLang === 'en' && targetLang === 'en') return text
  try {
    return await translateText(text, targetLang)
  } catch {
    return text
  }
}

// BUILD CHANNEL CONTEXT - CONTROLLED BY SETTINGS
function buildChannelContext() {
  const channelEnabled = getCache('channelEnabled')?? false // DEFAULT OFF
  const channelJid = getCache('channelJid') || ''
  const channelName = getCache('channelName') || 'SwiftBot Updates'
  const channelLink = getCache('channelLink') || 'https://whatsapp.com'

  if (!channelEnabled ||!channelJid) return {}

  return {
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      externalAdReply: {
        title: applyGlobalFont(getCache('botName') || 'SwiftBot'),
        body: applyGlobalFont('SwiftBot WhatsApp Bot'),
        thumbnailUrl: getCache('botPic'),
        mediaType: 1,
        renderLargerThumbnail: false,
        sourceUrl: channelLink,
        showAdAttribution: true
      },
      forwardedNewsletterMessageInfo: {
        newsletterJid: channelJid,
        newsletterName: channelName,
        serverMessageId: Math.floor(Math.random() * 100000)
      }
    }
  }
}

// MAIN COMMAND HANDLER - NO FROMME CHECK
export async function handleCommand(data) {
  const { sock, msg, command, args, isOwner, userLang, sender, isGroup } = data

  console.log(`[ROUTER] Incoming: "${command}" | From: ${sender.split('@')[0]} | Group: ${isGroup}`)

  if (commandCache.size === 0) loadCommandList()

  const cmd = await getCommand(command)
  if (!cmd) {
    console.log(`[ROUTER] Reject: Unknown command "${command}"`)
    return false
  }

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
    const channelContext = buildChannelContext()
    return sock.sendMessage(sender, { text: finalText,...channelContext }, { quoted: msg })
  }

  // REPLYIMG WRAPPER - PIC + CAPTION + CONTEXT
  const replyImg = async (url, caption) => {
    const translated = await t(caption, userLang)
    const finalCaption = applyGlobalFont(translated)
    const channelContext = buildChannelContext()
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
    console.log(`[ROUTER] Blocked: ${command} is disabled`)
    return true
  }

  // 3. CHECK OWNER ONLY
  const sudos = getCache('sudos') || []
  const senderNum = sender.split('@')[0]
  const isSudo = sudos.includes(senderNum)
  if (cmd.owner &&!isOwner &&!isSudo) {
    const msg = await t(`Command *${command}* is for owner only`, userLang)
    await reply(getBox('error', { text: msg }))
    await react('❌')
    console.log(`[ROUTER] Denied: ${command} requires owner`)
    return true
  }

  // 4. CHECK GROUP/PRIVATE
  if (cmd.group &&!isGroup) {
    const msg = await t(`Command *${command}* works in groups only`, userLang)
    await reply(getBox('error', { text: msg }))
    await react('❌')
    console.log(`[ROUTER] Denied: ${command} group-only in DM`)
    return true
  }

  if (cmd.private && isGroup) {
    const msg = await t(`Command *${command}* works in private chat only`, userLang)
    await reply(getBox('error', { text: msg }))
    await react('❌')
    console.log(`[ROUTER] Denied: ${command} DM-only in group`)
    return true
  }

  // 5. GLOBAL DATA - ALL PASSED HERE
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
      prefix: getCache('prefix') || '.',
      botLang: getCache('botLanguage') || 'en',
      publicMode: getCache('publicMode')?? true,
      fromMeMode: getCache('fromMeMode') || 'off',
      reactions: getCache('reactions')?? true,
      channelEnabled: getCache('channelEnabled')?? false,
      channelJid: getCache('channelJid') || '',
      channelName: getCache('channelName') || 'SwiftBot Updates',
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
    console.log(`[ROUTER] Executing: ${command}`)
    await cmd.run(globalData)
    await react('✅')
    console.log(`[ROUTER] Success: ${command} completed`)
    return true
  } catch (e) {
    console.log(`[ROUTER] Error [${command}]: ${e.message}`)
    const msg = await t(`Error running command *${command}*`, userLang)
    await reply(getBox('error', { text: msg, error: e.message }))
    await react('❌')
    return true
  }
}

// GET ALL COMMANDS - FOR.menu - SCANS SUBFOLDERS
export async function getAllCommands() {
  if (!fs.existsSync(pluginPath)) return []
  const allCommands = scanCommands(pluginPath)
  const commands = []

  for (const cmdFile of allCommands) {
    try {
      const command = await import(`file://${cmdFile.path}?update=${Date.now()}`)
      const cmd = command.default
      if (cmd && cmd.name) {
        commands.push({
          name: cmd.name,
          desc: cmd.desc || 'No description',
          category: cmd.category || cmdFile.name.split('/')[0] || 'general',
          owner: cmd.owner || false,
          group: cmd.group || false,
          private: cmd.private || false
        })
      }
    } catch (e) {
      console.log(`[ROUTER] Failed to load ${cmdFile.name}:`, e.message)
    }
  }
  return commands
}

// CLEAR COMMAND CACHE - FOR.reload
export function clearCommandCache() {
  commandCache.clear()
  console.log('[ROUTER] Command cache purged')
}