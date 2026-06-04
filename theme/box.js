import { getCache } from '../system/cache.js'

// 30 DIFFERENT BOX STYLES - HAKUNA ZINAZOFANANA
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
  },
  21: {
    name: 'Shadow',
    top: '▌│█║▌│█║▌ ',
    bottom: '▌│█║▌│█║▌',
    line: '▌│█ ',
    title: '█',
    desc: 'Shadow depth box'
  },
  22: {
    name: 'Flame',
    top: '🔱─⭓ ',
    bottom: '🔱────────────⭓',
    line: '🔱 ',
    title: '─',
    desc: 'Trident flame box'
  },
  23: {
    name: 'Cloud',
    top: '☁️─⭓ ',
    bottom: '☁️────────────⭓',
    line: '☁️ ',
    title: '─',
    desc: 'Cloud sky box'
  },
  24: {
    name: 'Skull',
    top: '💀━❐ ',
    bottom: '💀━━━━━━━━━━━━❐',
    line: '💀 ',
    title: '━',
    desc: 'Skull dark box'
  },
  25: {
    name: 'Heart',
    top: '💖─⭓ ',
    bottom: '💖────────────⭓',
    line: '💖 ',
    title: '─',
    desc: 'Heart love box'
  },
  26: {
    name: 'Dragon',
    top: '🐉═❐ ',
    bottom: '🐉═════════════❐',
    line: '🐉 ',
    title: '═',
    desc: 'Dragon power box'
  },
  27: {
    name: 'Rainbow',
    top: '🌈─⭓ ',
    bottom: '🌈────────────⭓',
    line: '🌈 ',
    title: '─',
    desc: 'Rainbow color box'
  },
  28: {
    name: 'Leaf',
    top: '🍃━⭓ ',
    bottom: '🍃━━━━━━━━━━━━⭓',
    line: '🍃 ',
    title: '━',
    desc: 'Nature leaf box'
  },
  29: {
    name: 'Ghost',
    top: '👻─❐ ',
    bottom: '👻─────────────❐',
    line: '👻 ',
    title: '─',
    desc: 'Ghost spooky box'
  },
  30: {
    name: 'Infinity',
    top: '♾️━⭓ ',
    bottom: '♾️━━━━━━━━━━━━⭓',
    line: '♾️ ',
    title: '━',
    desc: 'Infinity endless box'
  }
}

// GET BOX BY ID
export function getBoxStyle(id) {
  return BOX_STYLES[id] || BOX_STYLES[1]
}

// GET ALL BOXES - KWA.boxstats
export function getAllBoxStyles() {
  return Object.entries(BOX_STYLES).map(([id, box]) => ({
    id: parseInt(id),
    name: box.name,
    desc: box.desc,
    preview: `${box.top}Title\n${box.line}Content\n${box.bottom}`
  }))
}

// MAIN BOX GENERATOR - NO HARDCODE
export function getBox(type, data = {}) {
  const boxId = getCache('boxStyle') || 1
  const style = getBoxStyle(boxId)

  // DYNAMIC TEMPLATES - YOTE VERTICAL
  const templates = {
    menu: (d) => {
      let txt = `${style.top}${d.botName || 'BOT'}\n`
      txt += `${style.line}\n`
      txt += `${style.line}PREFIX: ${d.prefix || 'None'}\n`
      txt += `${style.line}MODE: ${d.mode || 'Public'}\n`
      txt += `${style.line}\n`
      txt += `${style.line}CATEGORIES:\n`
      txt += `${style.line}\n`
      if (d.categories && d.categories.length > 0) {
        d.categories.forEach(item => {
          txt += `${style.line}${item}\n`
        })
      }
      txt += `${style.line}\n`
      txt += `${style.line}TOTAL: ${d.total || 0} COMMANDS\n`
      txt += `${style.line}\n`
      txt += `${style.line}${d.usage || ''}\n`
      txt += `${style.line}${d.example || ''}\n`
      txt += `${style.bottom}`
      return txt
    },

    list: (d) => {
      let txt = `${style.top}${d.title || 'LIST'}\n`
      txt += `${style.line}\n`
      if (d.items && d.items.length > 0) {
        d.items.forEach(item => {
          txt += `${style.line}${item}\n`
        })
      } else {
        txt += `${style.line}No items\n`
      }
      txt += `${style.line}\n`
      if (d.footer) txt += `${style.line}${d.footer}\n`
      txt += `${style.bottom}`
      return txt
    },

    connect: (d) => {
      let txt = `${style.top}CONNECTED\n`
      txt += `${style.line}Bot: ${d.botName || ''}\n`
      txt += `${style.line}Platform: ${d.platform || ''}\n`
      txt += `${style.line}User: ${d.user || ''}\n`
      txt += `${style.line}Number: ${d.number || ''}\n`
      txt += `${style.line}Uptime: ${d.uptime || ''}\n`
      txt += `${style.line}Mode: ${d.mode || ''}\n`
      txt += `${style.bottom}`
      return txt
    },

    error: (d) => {
      let txt = `${style.top}ERROR\n`
      txt += `${style.line}${d.text || 'Unknown error'}\n`
      if (d.error) txt += `${style.line}Reason: ${d.error}\n`
      txt += `${style.bottom}`
      return txt
    },

    success: (d) => {
      let txt = `${style.top}SUCCESS\n`
      txt += `${style.line}${d.text || 'Done'}\n`
      txt += `${style.bottom}`
      return txt
    },

    info: (d) => {
      let txt = `${style.top}INFO\n`
      txt += `${style.line}${d.text || ''}\n`
      txt += `${style.bottom}`
      return txt
    },

    warning: (d) => {
      let txt = `${style.top}WARNING\n`
      txt += `${style.line}${d.text || ''}\n`
      txt += `${style.bottom}`
      return txt
    },

    stats: (d) => {
      let txt = `${style.top}BOT STATS\n`
      txt += `${style.line}Name: ${d.name || ''}\n`
      txt += `${style.line}Uptime: ${d.uptime || ''}\n`
      txt += `${style.line}Users: ${d.users || 0}\n`
      txt += `${style.line}Groups: ${d.groups || 0}\n`
      txt += `${style.line}Commands: ${d.cmds || 0}\n`
      txt += `${style.line}Mode: ${d.mode || ''}\n`
      txt += `${style.line}Platform: ${d.platform || ''}\n`
      txt += `${style.bottom}`
      return txt
    },

    help: (d) => {
      let txt = `${style.top}${d.title || 'HELP'}\n`
      txt += `${style.line}${d.desc || ''}\n`
      txt += `${style.line}Usage: ${d.usage || ''}\n`
      txt += `${style.bottom}`
      return txt
    },

    boxlist: (d) => {
      let txt = `${style.top}BOX STYLES\n`
      txt += `${style.line}\n`
      const boxes = getAllBoxStyles()
      boxes.forEach(b => {
        txt += `${style.line}${b.id}. ${b.name}\n`
        txt += `${style.line} └ ${b.desc}\n`
      })
      txt += `${style.line}\n`
      txt += `${style.line}Current: ${boxId}. ${style.name}\n`
      txt += `${style.line}Use:.setbox <id>\n`
      txt += `${style.bottom}`
      return txt
    },

    text: (d) => {
      let txt = `${style.top}${d.title || ''}\n`
      txt += `${style.line}${d.text || ''}\n`
      txt += `${style.bottom}`
      return txt
    }
  }

  const template = templates[type]
  if (!template) {
    // Generic fallback
    return `${style.top}${type.toUpperCase()}\n${style.line}${data.text || JSON.stringify(data)}\n${style.bottom}`
  }

  return template(data)
}