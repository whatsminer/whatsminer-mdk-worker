'use strict'

const withDevice = require('../with-device')

module.exports = withDevice(async (device) => {
  const stats = await device.fetchDeviceData(device.getMinerStats)
  return parseFloat(stats.fan_speed_out) || 0
})
