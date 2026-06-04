import axios from 'axios'
import FormData from 'form-data'

export default {
  name: 'setbotpic',
  desc: 'Change bot profile picture - uploads to free hosts',
  category: 'settings',
  owner: true,

  async run({ msg, reply, box, updateSettings, t, sock, sender }) {

    // 1. CHECK KAMA KUNA PICHA
    const messageType = Object.keys(msg.message)[0]
    const isImage = messageType === 'imageMessage'
    const isQuotedImage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

    if (!isImage &&!isQuotedImage) {
      const msg = await t(`Reply to an image or send image with caption ${settings.prefix}setbotpic`)
      return reply(box('error', { text: msg }))
    }

    const imageMsg = isImage? msg.message.imageMessage : msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage

    // 2. DOWNLOAD PICHA
    await reply(box('info', { text: 'Downloading image...' }))

    let buffer
    try {
      const stream = await sock.downloadMediaMessage(msg)
      buffer = Buffer.from([])
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
      }
    } catch (e) {
      const msg = await t('Failed to download image')
      return reply(box('error', { text: msg }))
    }

    await reply(box('info', { text: 'Uploading to 10 hosts... This may take 30s' }))

    // 3. UPLOAD TO 10 FREE HOSTS - FALLBACKS
    const hosts = [
      { name: 'ImgBB', fn: uploadImgBB },
      { name: 'FreeImage', fn: uploadFreeImage },
      { name: 'Imgur', fn: uploadImgur },
      { name: 'Catbox', fn: uploadCatbox },
      { name: 'TmpFiles', fn: uploadTmpFiles },
      { name: 'FileIO', fn: uploadFileIO },
      { name: '0x0', fn: upload0x0 },
      { name: 'Pixeldrain', fn: uploadPixeldrain },
      { name: 'GoFile', fn: uploadGoFile },
      { name: 'AnonFiles', fn: uploadAnonFiles }
    ]

    let finalUrl = null
    let usedHost = null

    for (const host of hosts) {
      try {
        console.log(`[BOTPIC] Trying ${host.name}...`)
        const url = await host.fn(buffer)
        if (url && url.startsWith('http')) {
          finalUrl = url
          usedHost = host.name
          console.log(`[BOTPIC] Success: ${host.name}`)
          break
        }
      } catch (e) {
        console.log(`[BOTPIC] ${host.name} failed: ${e.message}`)
      }
    }

    if (!finalUrl) {
      const msg = await t('All 10 hosts failed. Try again with smaller image')
      return reply(box('error', { text: msg }))
    }

    // 4. UPDATE DB/RAM
    await updateSettings('botPic', finalUrl)

    // 5. CONFIRM
    const successText = `Bot picture updated ✅\n\nHost: ${usedHost}\nURL: ${finalUrl}\n\nAll menus will now use this image`
    reply(box('success', { text: await t(successText) }))
  }
}

// ========== UPLOAD FUNCTIONS - 10 HOSTS ==========

async function uploadImgBB(buffer) {
  const form = new FormData()
  form.append('image', buffer.toString('base64'))
  const res = await axios.post('https://api.imgbb.com/1/upload?key=YOUR_FREE_KEY', form, {
    headers: form.getHeaders(),
    timeout: 30000
  })
  return res.data?.data?.url
}

async function uploadFreeImage(buffer) {
  const form = new FormData()
  form.append('source', buffer, 'image.jpg')
  form.append('type', 'file')
  form.append('action', 'upload')
  form.append('timestamp', Date.now())
  const res = await axios.post('https://freeimage.host/json', form, {
    headers: form.getHeaders(),
    timeout: 30000
  })
  return res.data?.image?.url
}

async function uploadImgur(buffer) {
  const form = new FormData()
  form.append('image', buffer.toString('base64'))
  form.append('type', 'base64')
  const res = await axios.post('https://api.imgur.com/3/image', form, {
    headers: {
    ...form.getHeaders(),
      'Authorization': 'Client-ID 546c25a59c58ad7' // Public client ID
    },
    timeout: 30000
  })
  return res.data?.data?.link
}

async function uploadCatbox(buffer) {
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('fileToUpload', buffer, 'image.jpg')
  const res = await axios.post('https://catbox.moe/user/api.php', form, {
    headers: form.getHeaders(),
    timeout: 30000
  })
  return res.data.trim()
}

async function uploadTmpFiles(buffer) {
  const form = new FormData()
  form.append('file', buffer, 'image.jpg')
  const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
    headers: form.getHeaders(),
    timeout: 30000
  })
  return res.data?.data?.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
}

async function uploadFileIO(buffer) {
  const form = new FormData()
  form.append('file', buffer, 'image.jpg')
  const res = await axios.post('https://file.io', form, {
    headers: form.getHeaders(),
    timeout: 30000
  })
  return res.data?.link
}

async function upload0x0(buffer) {
  const form = new FormData()
  form.append('file', buffer, 'image.jpg')
  const res = await axios.post('https://0x0.st', form, {
    headers: form.getHeaders(),
    timeout: 30000
  })
  return res.data.trim()
}

async function uploadPixeldrain(buffer) {
  const form = new FormData()
  form.append('file', buffer, 'image.jpg')
  const res = await axios.post('https://pixeldrain.com/api/file', form, {
    headers: form.getHeaders(),
    timeout: 30000
  })
  return `https://pixeldrain.com/api/file/${res.data.id}`
}

async function uploadGoFile(buffer) {
  const server = await axios.get('https://api.gofile.io/getServer')
  const serverName = server.data.data.server
  const form = new FormData()
  form.append('file', buffer, 'image.jpg')
  const res = await axios.post(`https://${serverName}.gofile.io/uploadFile`, form, {
    headers: form.getHeaders(),
    timeout: 30000
  })
  return res.data?.data?.downloadPage
}

async function uploadAnonFiles(buffer) {
  const form = new FormData()
  form.append('file', buffer, 'image.jpg')
  const res = await axios.post('https://api.anonfiles.com/upload', form, {
    headers: form.getHeaders(),
    timeout: 30000
  })
  return res.data?.data?.file?.url?.full
}