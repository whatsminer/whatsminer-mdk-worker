'use strict'

const withDevice = require('../with-device')

module.exports = withDevice(async (device) => {
  const stats = await device.fetchDeviceData(device.getMinerStats)
  return Math.floor((parseFloat(stats.hs_rt) || 0) / 10000) / 100
})
