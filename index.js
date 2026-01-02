require('dotenv').config()
const { backupSession, restoreSession } = require('./sessionBackup')


const express = require('express')
const qrcode = require('qrcode-terminal')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys')

const app = express()
app.use(express.json())

let sock

async function startWhatsApp() {
  await restoreSession()

  const { state, saveCreds } = await useMultiFileAuthState('./sessions')

  sock = makeWASocket({
    auth: state,
    browser: ['PodoAgenda', 'Chrome', '1.0'],
    syncFullHistory: false
  })

  sock.ev.on('creds.update', async () => {
    await saveCreds()
    await backupSession()
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update
  
    if (qr) {
      console.log('📱 Escaneie o QR Code abaixo:')
      qrcode.generate(qr, { small: true })
    }
  
    if (connection === 'open') {
      console.log('✅ WhatsApp conectado com sucesso!')
    }
  
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log('⚠️ Conexão fechada. Código:', reason)
  
      // 515 / quedas iniciais → reinicia automaticamente
      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔁 Reiniciando conexão automaticamente...')
        setTimeout(() => startWhatsApp(), 2000)
      } else {
        console.log('❌ WhatsApp deslogado. Será necessário novo QR Code.')
      }
    }
  })
}

app.post('/send', async (req, res) => {
  const { phone, message } = req.body
  if (!phone || !message) {
    return res.status(400).json({ error: 'phone e message são obrigatórios' })
  }
  try {
    const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net'
    await sock.sendMessage(jid, { text: message })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao enviar mensagem' })
  }
})

startWhatsApp()
app.listen(3000, () => {
  console.log('🚀 WhatsApp API rodando em http://localhost:3000')
})
