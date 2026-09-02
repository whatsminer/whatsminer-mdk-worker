'use strict'

const commandResult = require('./command-result')
const normalizeHostname = require('../../lib/utils/hostname')
const withDevice = require('../with-device')

module.exports = withDevice(async (device, params) => {
  const hostname = normalizeHostname(params?.hostname)
  return commandResult(await device.setHostname(hostname))
})
