'use strict'

const test = require('brittle')
const crypto = require('node:crypto')
const hex2a = require('../../lib/utils/hex2a')
const { sha256, aesEncrypt, aesEncryptRawKey, aesDecryptHex } = require('../../lib/utils/crypto')

function aesEncryptZeroPad (plaintext, key) {
  const data = Buffer.from(plaintext, 'utf8')
  const padded = Buffer.concat([data, Buffer.alloc((16 - (data.length % 16)) % 16)])
  const cipher = crypto.createCipheriv('aes-256-ecb', sha256(key), null)
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString('base64')
}

test('crypto - sha256 hex', (t) => {
  t.is(
    sha256('hello').toString('hex'),
    '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
  )
})

test('crypto - sha256 base64', (t) => {
  t.is(sha256('hello').toString('base64'), 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=')
})

test('crypto - aesEncrypt matches the crypto-js v2 envelope byte for byte', (t) => {
  // CryptoJS.AES.encrypt(plaintext, CryptoJS.SHA256(key), { mode: ECB }).toString()
  t.is(aesEncrypt('{"cmd":"summary"}', 'fixed-key'), '872DlVlPxauaqD4VdLQMqZKaxKuCYjERAIggHZCQEAA=')
})

test('crypto - aesEncryptRawKey uses the key without hashing it', (t) => {
  const key = sha256('fixed-key')
  t.is(aesEncryptRawKey('{"cmd":"summary"}', key), aesEncrypt('{"cmd":"summary"}', 'fixed-key'))
})

test('crypto - aes encrypt/decrypt roundtrip', (t) => {
  const key = 'secret-key'
  const plaintext = JSON.stringify({ cmd: 'get_token', token: 'abc' })
  t.is(hex2a(aesDecryptHex(aesEncrypt(plaintext, key), key)), plaintext)
})

test('crypto - decrypts zero-padded responses (2026 REL2 firmware)', (t) => {
  const key = 'j8hdt2YiO9SNFfDizt5EL.'
  const plaintext = '{"STATUS":"S","When":1788861546,"Code":131,"Msg":{"logfilelen":"2464934"},"Description":""}'
  const decrypted = hex2a(aesDecryptHex(aesEncryptZeroPad(plaintext, key), key))
  t.is(decrypted, plaintext)
  t.is(JSON.parse(decrypted).Code, 131)
})

test('crypto - decrypts an unpadded exact-block-multiple response', (t) => {
  const key = 'some-key'
  const plaintext = 'x'.repeat(48)
  t.is(hex2a(aesDecryptHex(aesEncryptZeroPad(plaintext, key), key)), plaintext)
})

test('crypto - non-block-aligned garbage still throws', (t) => {
  t.exception(() => aesDecryptHex(Buffer.from('abc').toString('base64'), 'k'))
})
