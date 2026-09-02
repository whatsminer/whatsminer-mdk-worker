'use strict'

const commandResult = require('./command-result')
const { decodeFirmwarePayload } = require('../../lib/utils/firmware-payload')
const withDevice = require('../with-device')

module.exports = withDevice(async (device, params) => {
  const source = decodeFirmwarePayload(params?.firmware, device.conf?.maxFirmwareSize)
  const result = commandResult(await device.updateFirmware(source.content))
  return {
    ...result,
    filename: source.filename,
    sourceSize: source.size,
    sourceSha256: source.sha256
  }
})
