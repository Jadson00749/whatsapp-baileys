require('dotenv').config()

const express = require('express')
const qrcode = require('qrcode-terminal')
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState
} = require('@whiskeysockets/baileys')

const { backupSession, restoreSession } = require('./sessionBackup')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const SESSION_NAME = process.env.SESSION_NAME || 'default'
const PHONE_NUMBER = '5516997242367' // Ex: 5511999999999

let sock

async function startWhatsApp() {
  console.log('🚀 Iniciando WhatsApp...')

  // 🔄 restaura sessão do Supabase
  await restoreSession()

  const { state, saveCreds } = await useMultiFileAuthState('sessions')

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['PodoAgenda', 'Chrome', '1.0']
  })

  sock.ev.on('creds.update', async () => {
    await saveCreds()
    await backupSession()
    console.log('💾 Sessão salva no Supabase')
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update
  
    if (connection === 'open') {
      console.log('🔗 Conexão aberta')
  
      if (!sock.authState.creds.registered) {
        try {
          const code = await sock.requestPairingCode(PHONE_NUMBER)
          console.log('📱 CÓDIGO DE PAREAMENTO:', code)
          console.log('👉 WhatsApp > Dispositivos conectados > Conectar com número')
        } catch (err) {
          console.error('❌ Erro ao gerar pairing code:', err)
        }
      } else {
        console.log('✅ WhatsApp conectado com sessão existente')
      }
    }
  
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log('⚠️ Conexão fechada. Código:', reason)
  
      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔁 Reconectando automaticamente...')
        setTimeout(startWhatsApp, 5000)
      } else {
        console.log('❌ WhatsApp deslogado. Novo pareamento necessário.')
      }
    }
  })
}

// 📩 Endpoint para enviar mensagens
app.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body

    if (!phone || !message) {
      return res.status(400).json({ error: 'phone e message são obrigatórios' })
    }

    const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net'

    await sock.sendMessage(jid, { text: message })

    res.json({ success: true })
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err)
    res.status(500).json({ error: 'Erro ao enviar mensagem' })
  }
})

// Health check (Render)
app.get('/', (_, res) => {
  res.send('WhatsApp API rodando 🚀')
})

app.listen(PORT, () => {
  console.log(`🌐 API rodando na porta ${PORT}`)
  startWhatsApp()
})
