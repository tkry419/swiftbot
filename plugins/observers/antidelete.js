import { getCache } from '../system/cache.js'

const messageCache = new Map()

export default {
  name: 'antidelete',
  desc: 'Restore deleted messages',
  category: 'automations',

  // CACHE KILA MESSAGE
  async onMessage({ msg, sender, isGroup }) {
    const antidelete = getCache('antidelete') ?? false
    if (!antidelete) return

    const messageId = msg.key.id
    const messageContent = msg.message

    // Cache text, image, video, audio, sticker
    if (messageContent) {
      messageCache.set(messageId, {
        sender,
        isGroup,
        content: messageContent,
        timestamp: Date.now()
      })

      // Auto delete cache after 5 mins ku-save RAM
      setTimeout(() => messageCache.delete(messageId), 300000)
    }
  },

  // DETECT DELETED MESSAGE
  async onMessageUpdate({ sock, update, t, box, settings }) {
    const antidelete = getCache('antidelete') ?? false
    if (!antidelete) return

    const messageId = update.key.id
    const cached = messageCache.get(messageId)

    if (!cached || !update.message?.protocolMessage?.type === 0) return

    const { sender, isGroup, content } = cached
    const deletedBy = update.key.participant || update.key.remoteJid
    const targetJid = isGroup ? update.key.remoteJid : sender

    try {
      // 1. NOTIFY
      const notifyText = `🗑️ *Antidelete*\n\nDeleted by: @${deletedBy.split('@')[0]}\nOriginal sender: @${sender.split('@')[0]}`
      
      await sock.sendMessage(targetJid, {
        text: notifyText,
        mentions: [deletedBy, sender]
      })

      // 2. RESEND CONTENT
      if (content.conversation) {
        await sock.sendMessage(targetJid, { text: `*Recovered text:*\n${content.conversation}` })
      }
      
      if (content.imageMessage) {
        const buffer = await sock.downloadMediaMessage({ message: { imageMessage: content.imageMessage } })
        await sock.sendMessage(targetJid, { 
          image: buffer, 
          caption: content.imageMessage.caption || '*Recovered image*'
        })
      }

      if (content.videoMessage) {
        const buffer = await sock.downloadMediaMessage({ message: { videoMessage: content.videoMessage } })
        await sock.sendMessage(targetJid, { 
          video: buffer, 
          caption: content.videoMessage.caption || '*Recovered video*'
        })
      }

      if (content.stickerMessage) {
        const buffer = await sock.downloadMediaMessage({ message: { stickerMessage: content.stickerMessage } })
        await sock.sendMessage(targetJid, { sticker: buffer })
      }

      messageCache.delete(messageId)
    } catch (e) {
      console.log('[ANTIDELETE] Failed to restore:', e.message)
    }
  }
}