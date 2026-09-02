'use strict'

const { POWER_MODE } = require('../../lib/constants')
const withDevice = require('../with-device')

module.exports = withDevice(async (device) => {
  const stats = await device.fetchDeviceData(device.getMinerStats)
  if ((parseFloat(stats.mhs_av) || 0) === 0) return POWER_MODE.SLEEP
  return stats.power_mode?.toLowerCase()
})
