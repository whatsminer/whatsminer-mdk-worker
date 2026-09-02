'use strict'

const withDevice = require('../with-device')

module.exports = withDevice(async (device) => {
  const stats = await device.fetchDeviceData(device.getMinerStats)
  const accepted = parseInt(stats.accepted, 10)
  if (Number.isFinite(accepted)) return accepted

  const pools = await device.fetchDeviceData(device.getPools)
  return pools.reduce((total, pool) => total + (parseInt(pool.accepted, 10) || 0), 0)
})
