import os from 'os'

export default {
  name: 'ping',
  desc: 'Check bot response speed and system status',
  category: 'general',
  owner: false,

  async run({ reply, box, font, t, react }) {
    const start = Date.now()
    await react('🏓')

    // 1. PINGA DB/RAM SPEED
    const pingStart = Date.now()
    await new Promise(r => setTimeout(r, 1)) // Simulate DB check
    const pingEnd = Date.now()
    const ping = pingEnd - pingStart

    // 2. SYSTEM INFO
    const uptime = process.uptime()
    const days = Math.floor(uptime / 86400)
    const hours = Math.floor((uptime % 86400) / 3600)
    const mins = Math.floor((uptime % 3600) / 60)
    const secs = Math.floor(uptime % 60)

    const memUsage = process.memoryUsage()
    const totalMem = os.totalmem()
    const usedMem = memUsage.rss
    const ramPercent = ((usedMem / totalMem) * 100).toFixed(2)

    // 3. RESPONSE TIME
    const responseTime = Date.now() - start

    const text = `${font('PONG!', 'boldscript')} 🏓

${font('Speed:', 'sansbold')} ${responseTime}ms
${font('Ping:', 'sansbold')} ${ping}ms
${font('RAM:', 'sansbold')} ${ramPercent}%
${font('Uptime:', 'sansbold')} ${days}d ${hours}h ${mins}m ${secs}s

${font('Status: Online ✅', 'italic')}`

    reply(box('info', { 
      title: font('Bot Status', 'bold'),
      text: await t(text)
    }))
  }
}