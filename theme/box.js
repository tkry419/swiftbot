// 20 DIFFERENT BOX STYLES - HAKUNA ZINAZOFANANA
const BOX_STYLES = {
  1: {
    name: 'Classic',
    top: '┌─⭓ ',
    bottom: '└─────────────⭓',
    line: '│ ',
    title: '─',
    desc: 'Simple classic box'
  },
  2: {
    name: 'Double',
    top: '╔══❐ ',
    bottom: '╚═════════════❐',
    line: '║ ',
    title: '═',
    desc: 'Double line heavy box'
  },
  3: {
    name: 'Rounded',
    top: '╭─⊷ ',
    bottom: '╰─────────────⊷',
    line: '│ ',
    title: '─',
    desc: 'Smooth rounded corners'
  },
  4: {
    name: 'Fire',
    top: '🔥─⭓ ',
    bottom: '🔥────────────⭓',
    line: '🔥 ',
    title: '─',
    desc: 'Fire themed box'
  },
  5: {
    name: 'Cyber',
    top: '┏━[',
    bottom: '┗━━━━━━━━━━━━┛',
    line: '┃ ',
    title: '━',
    desc: 'Cyberpunk style'
  },
  6: {
    name: 'Royal',
    top: '👑━⭓ ',
    bottom: '👑━━━━━━━━━━━━⭓',
    line: '👑 ',
    title: '━',
    desc: 'Royal crown box'
  },
  7: {
    name: 'Galaxy',
    top: '🌌─⭓ ',
    bottom: '🌌────────────⭓',
    line: '🌌 ',
    title: '─',
    desc: 'Space galaxy theme'
  },
  8: {
    name: 'Neon',
    top: '⚡═❐ ',
    bottom: '⚡═════════════❐',
    line: '⚡ ',
    title: '═',
    desc: 'Neon lightning box'
  },
  9: {
    name: 'Diamond',
    top: '💎─⭓ ',
    bottom: '💎────────────⭓',
    line: '💎 ',
    title: '─',
    desc: 'Diamond luxury'
  },
  10: {
    name: 'Matrix',
    top: '▓▒░ ',
    bottom: '░▒▓────────────░',
    line: '▓▒░ ',
    title: '░',
    desc: 'Matrix code style'
  },
  11: {
    name: 'Wave',
    top: '〰️─⭓ ',
    bottom: '〰️────────────⭓',
    line: '〰️ ',
    title: '─',
    desc: 'Wave pattern box'
  },
  12: {
    name: 'Arrow',
    top: '➤─❐ ',
    bottom: '➤─────────────❐',
    line: '➤ ',
    title: '─',
    desc: 'Arrow pointed box'
  },
  13: {
    name: 'Star',
    top: '⭐─⭓ ',
    bottom: '⭐────────────⭓',
    line: '⭐ ',
    title: '─',
    desc: 'Star themed box'
  },
  14: {
    name: 'Minimal',
    top: '─ ',
    bottom: '─────────────',
    line: ' ',
    title: '─',
    desc: 'Ultra minimal clean'
  },
  15: {
    name: 'Bold',
    top: '▰▰▰ ',
    bottom: '▰▰▰▰▰▰▰▰▰▰',
    line: '▰ ',
    title: '▰',
    desc: 'Bold block style'
  },
  16: {
    name: 'Dotted',
    top: '┄┄┄ ',
    bottom: '┄┄┄',
    line: '┊ ',
    title: '┄',
    desc: 'Dotted line box'
  },
  17: {
    name: 'Gradient',
    top: '░▒▓█ ',
    bottom: '█▓▒░────────────░',
    line: '█▓▒ ',
    title: '█',
    desc: 'Gradient blocks'
  },
  18: {
    name: 'Crystal',
    top: '🔮─⭓ ',
    bottom: '🔮────────────⭓',
    line: '🔮 ',
    title: '─',
    desc: 'Crystal ball magic'
  },
  19: {
    name: 'Tech',
    top: '◢◤ ',
    bottom: '◥◣────────────◣',
    line: '◢◤ ',
    title: '◢',
    desc: 'Tech triangle box'
  },
  20: {
    name: 'Premium',
    top: '✨━━━━━━━━━✨ ',
    bottom: '✨━━━━━━━━━━━━━━✨',
    line: '✨ ',
    title: '━',
    desc: 'Premium sparkle box'
  }
}

// GET BOX BY ID OR NAME
export function getBoxStyle(id) {
  return BOX_STYLES[id] || BOX_STYLES[1] // Default Classic
}

// GET ALL BOXES - KWA.boxstats
export function getAllBoxStyles() {
  return Object.entries(BOX_STYLES).map(([id, box]) => ({
    id: parseInt(id),
    name: box.name,
    desc: box.desc,
    preview: `${box.top}Title${box.title}\n${box.line}Content\n${box.bottom}`
  }))
}

// MAIN BOX GENERATOR - INATUMIA BOX ID KUTOKA DB
export function getBox(type, data = {}) {
  const boxId = getCache('boxStyle') || 1 // Default box 1
  const style = getBoxStyle(boxId)

  // BOX TEMPLATES
  const templates = {
    menu: (d) => `${style.top}${d.botName || 'Bot'}\n${style.line}Prefix: ${d.prefix || 'None'}\n${style.line}${d.commands || ''}\n${style.bottom}`,

    connect: (d) => `${style.top}CONNECTED${style.title}${style.title}\n${style.line}Bot: ${d.botName}\n${style.line}Platform: ${d.platform}\n${style.line}User: ${d.user}\n${style.line}Number: ${d.number}\n${style.line}Uptime: ${d.uptime}\n${style.line}Mode: ${d.mode}\n${style.bottom}`,

    error: (d) => `${style.top}ERROR\n${style.line}${d.text || 'Unknown error'}\n${d.error? `${style.line}Reason: ${d.error}\n` : ''}${style.bottom}`,

    success: (d) => `${style.top}SUCCESS\n${style.line}${d.text || 'Done'}\n${style.bottom}`,

    info: (d) => `${style.top}INFO\n${style.line}${d.text || ''}\n${style.bottom}`,

    warning: (d) => `${style.top}WARNING\n${style.line}${d.text || ''}\n${style.bottom}`,

    stats: (d) => `${style.top}BOT STATS\n${style.line}Name: ${d.name}\n${style.line}Uptime: ${d.uptime}\n${style.line}Users: ${d.users}\n${style.line}Groups: ${d.groups}\n${style.line}Commands: ${d.cmds}\n${style.line}Mode: ${d.mode}\n${style.line}Platform: ${d.platform}\n${style.bottom}`,

    help: (d) => `${style.top}${d.title || 'HELP'}\n${style.line}${d.desc || ''}\n${style.line}Usage: ${d.usage || ''}\n${style.bottom}`,

    list: (d) => {
      let txt = `${style.top}${d.title || 'LIST'}\n`
      if (d.items && d.items.length > 0) {
        d.items.forEach((item, i) => {
          txt += `${style.line}${i + 1}. ${item}\n`
        })
      } else {
        txt += `${style.line}No items\n`
      }
      txt += style.bottom
      return txt
    },

    boxlist: (d) => {
      let txt = `${style.top}BOX STYLES\n`
      const boxes = getAllBoxStyles()
      boxes.forEach(b => {
        txt += `${style.line}${b.id}. ${b.name} - ${b.desc}\n`
      })
      txt += `${style.line}\n${style.line}Current: ${boxId}. ${style.name}\n${style.line}Use:.setbox <id>\n${style.bottom}`
      return txt
    }
  }

  const template = templates[type]
  if (!template) {
    // Generic box
    return `${style.top}${type.toUpperCase()}\n${style.line}${data.text || JSON.stringify(data)}\n${style.bottom}`
  }

  return template(data)
}

// IMPORT getCache FROM cache.js
import { getCache } from '../system/cache.js'