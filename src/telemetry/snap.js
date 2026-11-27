'use strict'

const withDevice = require('../with-device')

// getSnap reports a failed read as { success: false } for library callers; a
// telemetry channel must fail instead of resolving with that placeholder.
module.exports = withDevice(async (device) => {
  const snap = await device.getSnap()
  if (snap?.success) return snap
  if (snap?.stats?.status === 'offline') throw new Error('ERR_OFFLINE')
  const msg = snap?.stats?.errors?.[0]?.msg || 'Unknown error'
  throw new Error(/^ERR_[A-Z0-9_]+/.test(msg) ? msg : `ERR_SNAP_FAILED: ${msg}`)
})
