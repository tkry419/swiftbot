export default {
  name: 'antidelete',
  desc: 'Enable or disable antidelete feature',
  category: 'automations',
  owner: true,

  async run({ args, reply, box, t, updateSettings, settings }) {
    const action = args[0]?.toLowerCase()
    const p = settings.prefix || '.'

    // 1. TURN ON
    if (action === 'on') {
      await updateSettings('antidelete', true)
      const msg = await t('Antidelete enabled ✅\nDeleted messages will be restored')
      return reply(box('success', { text: msg }))
    }

    // 2. TURN OFF - DEFAULT
    if (action === 'off') {
      await updateSettings('antidelete', false)
      const msg = await t('Antidelete disabled ✅\nMessages will not be restored')
      return reply(box('success', { text: msg }))
    }

    // 3. SHOW STATUS
    const status = settings.antidelete ? 'ENABLED' : 'DISABLED'
    const statusEmoji = settings.antidelete ? '🟢' : '🔴'

    const infoText = `${statusEmoji} Antidelete: ${status}

When enabled, bot will restore any deleted messages in groups or private chat.

Commands:
${p}antidelete on - Enable feature
${p}antidelete off - Disable feature`

    reply(box('info', {
      title: 'Antidelete Settings',
      text: await t(infoText)
    }))
  }
}