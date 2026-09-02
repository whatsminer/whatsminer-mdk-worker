'use strict'

const { STATUS } = require('../../lib/constants')
const withDevice = require('../with-device')

module.exports = withDevice(async (device) => {
  const errors = await device.fetchDeviceData(device.getErrors)
  if (Array.isArray(errors) && errors.length > 0) return STATUS.ERROR
  const stats = await device.fetchDeviceData(device.getMinerStats)
  return (parseFloat(stats.mhs_av) || 0) > 0 ? STATUS.MINING : STATUS.SLEEPING
})
