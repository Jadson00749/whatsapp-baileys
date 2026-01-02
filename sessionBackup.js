const fs = require('fs')
const os = require('os')
const path = require('path')
const archiver = require('archiver')
const unzipper = require('unzipper')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'whatsapp-sessions'
const SESSION_NAME = process.env.SESSION_NAME || 'default'
const ZIP_PATH = path.join(os.tmpdir(), `${SESSION_NAME}.zip`)


const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function backupSession() {
  if (!fs.existsSync('./sessions')) return

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(ZIP_PATH)
    const archive = archiver('zip')

    archive.pipe(output)
    archive.directory('./sessions', false)
    archive.finalize()

    output.on('close', resolve)
    archive.on('error', reject)
  })

  const fileStream = fs.createReadStream(ZIP_PATH)

  await supabase.storage
    .from(BUCKET)
    .upload(`${SESSION_NAME}.zip`, fileStream, {
      upsert: true,
      contentType: 'application/zip'
    })

  console.log('💾 Sessão salva no Supabase')
}

async function restoreSession() {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`${SESSION_NAME}.zip`)

  if (error || !data) {
    console.log('ℹ️ Nenhuma sessão encontrada no Supabase')
    return
  }

  await new Promise((resolve) => {
    data
      .pipe(unzipper.Extract({ path: './sessions' }))
      .on('close', resolve)
  })

  console.log('♻️ Sessão restaurada do Supabase')
}

module.exports = { backupSession, restoreSession }
