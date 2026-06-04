import { getCache } from '../../system/cache.js'

const messageCache = new Map()

// Cleanup cache kila dakika 5 ku-save RAM
setInterval(() => {
  const now = Date.now()
  for (const [id, data] of messageCache.entries()) {
    if (now - data.timestamp > 300000) messageCache.delete(id)
  }
}, 60000)

export default {
  name: 'antidelete',
  desc: 'Restore deleted messages - Groups, DM, Status, Channels',
  category: 'automations',

  async onMessageUpdate({ sock, update, settings }) {
    const antidelete = getCache('antidelete') ?? false
    if (!antidelete) return

    const messageId = update.key.id
    const remoteJid = update.key.remoteJid

    // 1. KAMA NI MESSAGE MPYA - CACHE IT
    if (update.message && !update.message?.protocolMessage) {
      const sender = update.key.participant || remoteJid
      const isGroup = remoteJid.endsWith('@g.us')
      const isStatus = remoteJid === 'status@broadcast'
      const isChannel = remoteJid.endsWith('@newsletter')
      
      // Skip status zenye autodelete 24h - WhatsApp default
      if (isStatus && update.message?.ephemeralMessage?.message?.contextInfo?.expiration === 86400) {
        return
      }
      
      messageCache.set(messageId, {
        sender,
        isGroup,
        isStatus,
        isChannel,
        content: update.message,
        timestamp: Date.now(),
        key: update.key
      })
      return
    }

    // 2. KAMA NI DELETE - RESTORE
    if (update.message?.protocolMessage?.type === 0) {
      const cached = messageCache.get(messageId)
      if (!cached) {
        console.log('[ANTIDELETE] No cache found for:', messageId)
        return
      }

      const { sender, isGroup, isStatus, isChannel, content, key } = cached
      const deletedBy = update.key.participant || update.key.remoteJid
      
      // CHOOSE TARGET JID - User custom location au default
      const customLocation = getCache('antideleteLocation') || '' // Weka JID hapa
      const ownerJid = getCache('ownerJid') || sock.user.id
      let targetJid = customLocation || remoteJid

      // Status: tuma kwa owner kama user haja-set location
      if (isStatus && !customLocation) targetJid = ownerJid
      // Channel: tuma kwa owner kama user haja-set location  
      if (isChannel && !customLocation) targetJid = ownerJid

      try {
        // 1. NOTIFY
        let notifyText = `🗑️ *Antidelete Alert*\n\n`
        notifyText += `Deleted by: @${deletedBy.split('@')[0]}\n`
        notifyText += `Original sender: @${sender.split('@')[0]}\n`
        notifyText += `Type: ${isStatus ? 'Status' : isChannel ? 'Channel' : isGroup ? 'Group' : 'DM'}`

        await sock.sendMessage(targetJid, {
          text: notifyText,
          mentions: [deletedBy, sender]
        })

        // 2. RESEND CONTENT
        if (content.conversation) {
          await sock.sendMessage(targetJid, { 
            text: `*Recovered Text:*\n${content.conversation}` 
          })
        }

        if (content.extendedTextMessage?.text) {
          await sock.sendMessage(targetJid, { 
            text: `*Recovered Text:*\n${content.extendedTextMessage.text}` 
          })
        }

        // IMAGE - STATUS & NORMAL
        if (content.imageMessage || content.ephemeralMessage?.message?.imageMessage) {
          const imgMsg = content.imageMessage || content.ephemeralMessage.message.imageMessage
          const buffer = await sock.downloadMediaMessage({ message: { imageMessage: imgMsg }, key })
          await sock.sendMessage(targetJid, { 
            image: buffer, 
            caption: imgMsg.caption || '*Recovered Image*'
          })
        }

        // VIDEO - MP4 + STATUS
        if (content.videoMessage || content.ephemeralMessage?.message?.videoMessage) {
          const vidMsg = content.videoMessage || content.ephemeralMessage.message.videoMessage
          const buffer = await sock.downloadMediaMessage({ message: { videoMessage: vidMsg }, key })
          await sock.sendMessage(targetJid, { 
            video: buffer, 
            caption: vidMsg.caption || '*Recovered Video*',
            mimetype: vidMsg.mimetype || 'video/mp4'
          })
        }

        // AUDIO - MP3, VOICE NOTE
        if (content.audioMessage || content.ephemeralMessage?.message?.audioMessage) {
          const audMsg = content.audioMessage || content.ephemeralMessage.message.audioMessage
          const buffer = await sock.downloadMediaMessage({ message: { audioMessage: audMsg }, key })
          await sock.sendMessage(targetJid, { 
            audio: buffer, 
            mimetype: audMsg.mimetype || 'audio/mpeg',
            ptt: audMsg.ptt || false
          })
        }

        // STICKER
        if (content.stickerMessage || content.ephemeralMessage?.message?.stickerMessage) {
          const stkMsg = content.stickerMessage || content.ephemeralMessage.message.stickerMessage
          const buffer = await sock.downloadMediaMessage({ message: { stickerMessage: stkMsg }, key })
          await sock.sendMessage(targetJid, { sticker: buffer })
        }

        // DOCUMENT
        if (content.documentMessage || content.ephemeralMessage?.message?.documentMessage) {
          const docMsg = content.documentMessage || content.ephemeralMessage.message.documentMessage
          const buffer = await sock.downloadMediaMessage({ message: { documentMessage: docMsg }, key })
          await sock.sendMessage(targetJid, { 
            document: buffer, 
            fileName: docMsg.fileName || 'Recovered Document',
            mimetype: docMsg.mimetype
          })
        }

        messageCache.delete(messageId)
        console.log(`[ANTIDELETE] Restored ${isStatus ? 'Status' : isChannel ? 'Channel' : 'Message'} ${messageId}`)
      } catch (e) {
        console.log('[ANTIDELETE] Failed to restore:', e.message)
      }
    }
  }
}