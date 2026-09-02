'use strict'

const withDevice = require('../with-device')

module.exports = withDevice(async (device) => String(device.apiVersion || ''))
