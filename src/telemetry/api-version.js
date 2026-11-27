'use strict'

const withDevice = require('../with-device')

// Read the version from the device so a stopped miner fails this channel
// rather than echoing the API version the client was configured with.
module.exports = withDevice(async (device) => {
  const version = await device.fetchDeviceData(device.getVersion)
  return String(version?.apiVersion || device.apiVersion || '')
})
