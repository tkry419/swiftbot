import { getAllCommands } from '../../system/router.js'

export default {
  name: 'menu',
  desc: 'Show bot menu with all commands',
  category: 'general',
  owner: false,

  async run({ replyImg, reply, settings, box, font, t, args, isOwner, sender }) {
    const { botName, botPic, prefix } = settings
    const senderNum = sender.split('@')[0]
    const isSudo = settings.sudos.includes(senderNum)

    // 1. PATA COMMANDS ZOTE
    const allCommands = await getAllCommands()

    // 2. GROUP KWA CATEGORY - FILTER OWNER COMMANDS
    const categories = {}
    for (const cmd of allCommands) {
      if (cmd.owner &&!isOwner &&!isSudo) continue
      const cat = cmd.category || 'general'
      if (!categories[cat]) categories[cat] = []
      categories[cat].push(cmd)
    }

    // 3. KAMA NI "menu 1" AU "menu general" - ONYESHA COMMANDS
    if (args[0]) {
      const targetInput = args[0].toLowerCase()
      let targetCat = targetInput
      let catCommands = categories[targetCat]

      // Support namba: "menu 1" = first category
      if (!isNaN(targetInput)) {
        const sortedCats = Object.keys(categories).sort()
        const index = parseInt(targetInput) - 1
        if (index >= 0 && index < sortedCats.length) {
          targetCat = sortedCats[index]
          catCommands = categories[targetCat]
        }
      }

      if (!catCommands || catCommands.length === 0) {
        const msg = await t(`Category "${targetInput}" not found`)
        return reply(box('error', { text: msg }))
      }

      // TUMIA box('list') - HAKUNA HARDCODE
      const items = catCommands.map((cmd, i) =>
        `${i + 1}. ${font(cmd.name, 'sansbold')}\n└ ${font(cmd.desc, 'italic')}`
      )

      const menuText = box('list', {
        title: font(targetCat.toUpperCase(), 'boldscript'),
        items: items,
        footer: font(`Total: ${catCommands.length} commands`, 'italic')
      })

      const translated = await t(menuText)
      return await replyImg(botPic, translated) // PIC FROM DB/RAM
    }

    // 4. MAIN MENU - TUMIA box('menu') - HAKUNA HARDCODE
    let totalCmds = 0
    const sortedCats = Object.keys(categories).sort()

    const categoryItems = sortedCats.map((cat, i) => {
      const count = categories[cat].length
      totalCmds += count
      return `${i + 1}. ${font(cat.toUpperCase(), 'sansbold')}\n└ ${font(`${count} commands`, 'italic')}`
    })

    const currentPrefix = prefix || '.'
    const menuText = box('menu', {
      botName: font(botName, 'boldscript'),
      prefix: font(currentPrefix, 'monospace'),
      mode: settings.publicMode? 'Public' : 'Private',
      categories: categoryItems,
      total: totalCmds,
      usage: font(`Type "${currentPrefix}menu <number>"`, 'italic'),
      example: font(`Example: "${currentPrefix}menu 1"`, 'italic')
    })

    const translated = await t(menuText)
    await replyImg(botPic, translated) // PIC FROM DB/RAM
  }
}