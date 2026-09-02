'use strict'

const withDevice = require('../with-device')

module.exports = withDevice(async (device) => {
  const stats = await device.fetchDeviceData(device.getMinerStats)
  const rejected = parseInt(stats.rejected, 10)
  if (Number.isFinite(rejected)) return rejected

  const pools = await device.fetchDeviceData(device.getPools)
  return pools.reduce((total, pool) => total + (parseInt(pool.rejected, 10) || 0), 0)
})
