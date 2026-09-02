'use strict'

const commandResult = require('./command-result')
const normalizeNetworkConfig = require('../../lib/utils/network')
const withDevice = require('../with-device')

module.exports = withDevice(async (device, params) => {
  const network = normalizeNetworkConfig(params?.network)
  return commandResult(await device.setNetworkInformation(network))
})
