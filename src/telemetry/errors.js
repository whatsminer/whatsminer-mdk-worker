'use strict'

const withDevice = require('../with-device')

module.exports = withDevice(async (device) => {
  const errors = await device.fetchDeviceData(device.getErrors)
  return Array.isArray(errors) ? errors : []
})
