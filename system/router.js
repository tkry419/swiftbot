import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getCache } from './cache.js'
import { isCmdDisabled } from './db.js'
import { getBox } from '../theme/box.js'
import { fancyText } from '../theme/fonts.js'
import { translateText } from '../agent/ai.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// LAZY LOAD COMMANDS - HAKUNA HARDCODE
const commandCache = new Map()
const pluginPath = join(__dirname, '..', 'plugins', 'commands')

// SCAN PLUGINS FOLDER KUSOMA MAJINA TU
function loadCommandList() {
  if (!fs.existsSync(pluginPath)) {
    console.log('[ROUTER] No plugins folder found')
    return
  }
  
  const files = fs.readdirSync(pluginPath).filter(f => f.endsWith('.js'))
  console.log(`[ROUTER] Found ${files.length} command files`)
}

// DYNAMIC IMPORT COMMAND
async function getCommand(cmdName) {
  try {
    // Check cache kwanza
    if (commandCache.has(cmdName)) {
      return commandCache.get(cmdName)
    }

    const filePath = join(pluginPath, `${cmdName}.js`)
    if (!fs.existsSync(filePath)) return null

    const command = await import(`file://${filePath}`)
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

// TRANSLATE HELPER - KWA COMMANDS ZOTE
async function t(text, userLang) {
  const botLang = getCache('botLanguage') || 'en'
  const targetLang = userLang || botLang
  if (targetLang === 'en' || !text) return text
  
  try {
    return await translateText(text, targetLang)
  } catch {
    return text
  }
}

// MAIN COMMAND HANDLER
export async function handleCommand(data) {
  const { command, args, replyImg, isOwner, userLang } = data
  
  // 1. LOAD COMMAND LIST ON FIRST RUN
  if (commandCache.size === 0) loadCommandList()
  
  // 2. CHECK IF COMMAND EXISTS
  const cmd = await getCommand(command)
  if (!cmd) return false
  
  // 3. CHECK IF DISABLED
  if (await isCmdDisabled(command)) {
    const msg = await t(`Command *${command}* is disabled by owner`, userLang)
    await reply(getBox('error', { text: msg }))
    return true
  }
  
  // 4. CHECK OWNER ONLY
  if (cmd.owner && !isOwner) {
    const msg = await t(`Command *${command}* is for owner only`, userLang)
    await reply(getBox('error', { text: msg }))
    return true
  }
  
  // 5. CHECK GROUP ONLY
  if (cmd.group && !data.isGroup) {
    const msg = await t(`Command *${command}* works in groups only`, userLang)
    await reply(getBox('error', { text: msg }))
    return true
  }
  
  // 6. CHECK PRIVATE ONLY
  if (cmd.private && data.isGroup) {
    const msg = await t(`Command *${command}* works in private chat only`, userLang)
    await reply(getBox('error', { text: msg }))
    return true
  }
  
  // 7. GLOBAL SETTINGS - ZOTE ZINATUMWA KWA COMMAND
  const globalData = {
    ...data,
    box: getBox, // Command inaweza kutumia box('menu', {...})
    font: fancyText, // Command inaweza kutumia font('text', 'bold')
    t: (text) => t(text, userLang), // Translate function
    settings: {
      botName: getCache('botName'),
      prefix: getCache('prefix'),
      botLang: getCache('botLanguage'),
      publicMode: getCache('publicMode'),
      fromMeMode: getCache('fromMeMode'),
      reactions: getCache('reactions'),
      channelLink: getCache('channelLink'),
      botPic: getCache('botPic'),
      autoJoin: getCache('autoJoin'),
      sudos: getCache('sudos') || []
    }
  }
  
  // 8. RUN COMMAND
  try {
    await cmd.run(globalData)
    return true
  } catch (e) {
    console.log(`[ROUTER] Command ${command} error:`, e)
    const msg = await t(`Error running command *${command}*`, userLang)
    await reply(getBox('error', { text: msg, error: e.message }))
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
    if (cmd) {
      commands.push({
        name: cmdName,
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