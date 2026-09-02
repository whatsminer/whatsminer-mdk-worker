'use strict'

const commandResult = require('./command-result')
const withDevice = require('../with-device')

module.exports = withDevice(async (device, params) => {
  if (params.pools !== undefined && !Array.isArray(params.pools)) {
    throw new Error('ERR_INVALID_ARG_TYPE')
  }
  if (Array.isArray(params.pools) && params.pools.length) {
    return commandResult(await device.setPools(params.pools, params.appendId !== false))
  }
  return commandResult(await device.setupPools())
})
