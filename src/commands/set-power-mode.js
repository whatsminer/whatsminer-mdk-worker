'use strict'

const commandResult = require('./command-result')
const withDevice = require('../with-device')

module.exports = withDevice(async (device, params) => commandResult(await device.setPowerMode(params.mode)))
