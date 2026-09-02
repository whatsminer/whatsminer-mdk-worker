'use strict'

const withDevice = require('../with-device')

module.exports = withDevice(async (device) => {
  const stats = await device.fetchDeviceData(device.getMinerStats)
  return Math.floor((parseFloat(stats.power_rate) || 0) * 100) / 100
})
