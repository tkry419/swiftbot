export default {
  name: 'antidelete',
  desc: 'Enable/disable antidelete and set restore location',
  category: 'settings',
  owner: true,

  async run({ args, reply, box, t, updateSettings, settings }) {
    const action = args[0]?.toLowerCase()
    const value = args[1]
    const p = settings.prefix || '.'

    // 1. TURN ON
    if (action === 'on') {
      await updateSettings('antidelete', true)
      const msg = await t('Antidelete enabled ✅\n\nDeleted messages from groups, DM, status and channels will be restored')
      return reply(box('success', { text: msg }))
    }

    // 2. TURN OFF
    if (action === 'off') {
      await updateSettings('antidelete', false)
      const msg = await t('Antidelete disabled ✅\nMessages will not be restored')
      return reply(box('success', { text: msg }))
    }

    // 3. SET CUSTOM LOCATION - JID au namba
    if (action === 'set') {
      if (!value) {
        const msg = await t(`Usage: ${p}antidelete set <number|jid>\n\nExample: ${p}antidelete set 255xxx\nExample: ${p}antidelete set 120363xxx@g.us`)
        return reply(box('error', { text: msg }))
      }

      let targetJid = value
      // Convert number to JID if needed
      if (/^\d+$/.test(value)) {
        targetJid = value + '@s.whatsapp.net'
      }

      // Validate JID format
      if (!targetJid.includes('@')) {
        const msg = await t('Invalid JID or number. Use full number like 255xxx or full JID')
        return reply(box('error', { text: msg }))
      }

      await updateSettings('antideleteLocation', targetJid)
      const msg = await t(`Antidelete location set ✅\n\nAll recovered messages will be sent to:\n${targetJid}`)
      return reply(box('success', { text: msg }))
    }

    // 4. RESET LOCATION - Rudi default
    if (action === 'reset') {
      await updateSettings('antideleteLocation', '')
      const msg = await t('Antidelete location reset ✅\n\nMessages will be restored to their original chat')
      return reply(box('success', { text: msg }))
    }

    // 5. SHOW STATUS
    const status = settings.antidelete? 'ENABLED' : 'DISABLED'
    const statusEmoji = settings.antidelete? '🟢' : '🔴'
    const location = settings.antideleteLocation
     ? `\n📍 Restore Location: ${settings.antideleteLocation}`
      : '\n📍 Restore Location: Original chat'

    const infoText = `${statusEmoji} Antidelete: ${status}${location}

When enabled, bot restores deleted messages from:
• Groups & Private Chat
• WhatsApp Status
• WhatsApp Channels
• Supports: Text, Image, Video, Audio, Sticker, Document

Commands:
${p}antidelete on - Enable feature
${p}antidelete off - Disable feature
${p}antidelete set <number> - Set custom restore location
${p}antidelete reset - Reset to default location

Note: Status with 24h auto-delete are ignored`

    reply(box('info', {
      title: 'Antidelete Settings',
      text: await t(infoText)
    }))
  }
}