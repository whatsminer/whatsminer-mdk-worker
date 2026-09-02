'use strict'

const withDevice = require('../with-device')

module.exports = withDevice(async (device) => device.fetchDeviceData(device.getVersion))
