'use strict'

const crypto = require('node:crypto')

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest()
}

// AES-256-ECB with PKCS#7 padding, keyed by a 32-byte key used as-is.
function aesEncryptRawKey (plaintext, key) {
  const cipher = crypto.createCipheriv('aes-256-ecb', key, null)
  return Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]).toString('base64')
}

// API v2 envelope: AES-256-ECB keyed by SHA256(key).
function aesEncrypt (plaintext, key) {
  return aesEncryptRawKey(plaintext, sha256(key))
}

function aesDecryptHex (ciphertext, key) {
  const decipher = crypto.createDecipheriv('aes-256-ecb', sha256(key), null)
  try {
    return Buffer.concat([decipher.update(ciphertext, 'base64'), decipher.final()]).toString('hex')
  } catch (err) {
    // Firmware 2026xx REL2 zero-pads responses instead of PKCS#7, which the
    // default unpadding rejects as 'bad decrypt' — retry raw and strip the NULs
    const raw = crypto.createDecipheriv('aes-256-ecb', sha256(key), null)
    raw.setAutoPadding(false)
    let out
    try {
      out = Buffer.concat([raw.update(ciphertext, 'base64'), raw.final()])
    } catch {
      throw err
    }
    let end = out.length
    while (end > 0 && out[end - 1] === 0) end--
    return out.subarray(0, end).toString('hex')
  }
}

module.exports = {
  sha256,
  aesEncrypt,
  aesEncryptRawKey,
  aesDecryptHex
}
