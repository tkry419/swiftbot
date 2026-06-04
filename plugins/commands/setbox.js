import { getAllBoxStyles, getBoxStyle } from '../../theme/box.js'
import { setCache } from '../../system/cache.js'

export default {
  name: 'setbox',
  desc: 'Change global bot box style',
  category: 'settings',
  owner: true,

  async run({ args, reply, box, t, updateSettings, settings }) {

    // 1. KAMA HAKUNA ARG - ONYESHA BOXES ZOTE
    if (!args[0]) {
      const menuText = box('boxlist', {})
      return reply(menuText)
    }

    // 2. PATA BOX ID
    const boxId = parseInt(args[0])
    const allBoxes = getAllBoxStyles()
    const validIds = allBoxes.map(b => b.id)

    if (isNaN(boxId) ||!validIds.includes(boxId)) {
      const msg = await t(`Invalid box ID. Use.setbox to see all 30 styles`)
      return reply(box('error', { text: msg }))
    }

    // 3. UPDATE DB + CACHE
    const selectedBox = getBoxStyle(boxId)
    await updateSettings('boxStyle', boxId)
    setCache('boxStyle', boxId)

    // 4. CONFIRM NA PREVIEW
    const preview = box('success', {
      text: `Box style changed to: ${selectedBox.name}\n\n${selectedBox.desc}\n\nPreview:\n${selectedBox.preview}`
    })

    reply(preview)
  }
}