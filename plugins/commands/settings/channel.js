export default {
  name: 'channel',
  desc: 'Manage channel context for all bot messages',
  category: 'settings',
  owner: true,

  async run({ args, reply, box, updateSettings, settings, t }) {

    const action = args[0]?.toLowerCase()
    const value = args.slice(1).join(' ')
    const p = settings.prefix || '.' // DYNAMIC PREFIX

    // 1. TURN ON
    if (action === 'on') {
      if (!settings.channelJid) {
        const msg = await t(`Set channel JID first: ${p}channel set <jid>`)
        return reply(box('error', { text: msg }))
      }
      await updateSettings('channelEnabled', true)
      const msg = await t('Channel context enabled ✅\nAll messages will show forwarded channel')
      return reply(box('success', { text: msg }))
    }

    // 2. TURN OFF - DEFAULT
    if (action === 'off') {
      await updateSettings('channelEnabled', false)
      const msg = await t('Channel context disabled ✅\nMessages will be sent clean')
      return reply(box('success', { text: msg }))
    }

    // 3. SET CHANNEL JID
    if (action === 'set' && args[1]) {
      const jid = args[1].trim()
      if (!jid.includes('@newsletter')) {
        const msg = await t('Invalid channel JID. Must end with @newsletter')
        return reply(box('error', { text: msg }))
      }
      await updateSettings('channelJid', jid)
      const msg = await t(`Channel JID updated ✅\n${jid}`)
      return reply(box('success', { text: msg }))
    }

    // 4. SET CHANNEL NAME
    if (action === 'name' && value) {
      await updateSettings('channelName', value)
      const msg = await t(`Channel name updated ✅\n${value}`)
      return reply(box('success', { text: msg }))
    }

    // 5. SET CHANNEL LINK
    if (action === 'link' && args[1]) {
      const link = args[1].trim()
      if (!link.startsWith('https://')) {
        const msg = await t('Invalid link. Must start with https://')
        return reply(box('error', { text: msg }))
      }
      await updateSettings('channelLink', link)
      const msg = await t('Channel link updated ✅')
      return reply(box('success', { text: msg }))
    }

    // 6. SHOW CURRENT STATUS
    const status = settings.channelEnabled? 'ENABLED' : 'DISABLED'
    const statusEmoji = settings.channelEnabled? '🟢' : '🔴'

    const infoText = `${statusEmoji} Channel Context: ${status}

JID: ${settings.channelJid || 'Not set'}
Name: ${settings.channelName || 'SwiftBot Updates'}
Link: ${settings.channelLink || 'https://whatsapp.com'}

Commands:
${p}channel on - Enable context
${p}channel off - Disable context
${p}channel set <jid> - Set channel JID
${p}channel name <name> - Set channel name
${p}channel link <url> - Set channel link`

    reply(box('info', {
      title: 'Channel Settings',
      text: await t(infoText)
    }))
  }
}