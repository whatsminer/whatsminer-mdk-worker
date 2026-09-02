'use strict'

const path = require('node:path')

const address = process.argv[2]
const port = process.argv[3] ? Number(process.argv[3]) : undefined
const password = process.env.WHATSMINER_PASSWORD
const account = process.env.WHATSMINER_ACCOUNT || 'admin'
const mdkRepo = process.env.MDK_REPO || path.resolve(__dirname, '../../mdk')

if (!address || !password || (port !== undefined && !Number.isInteger(port))) {
  console.error('usage: WHATSMINER_PASSWORD=... node scripts/test-live-readonly.js <address> [4433|4028]')
  process.exit(1)
}

const WorkerRuntimeV2 = require(path.join(mdkRepo, 'backend/core/mdk-worker/lib/worker-runtime-v2'))
const workerDir = path.resolve(__dirname, '..')
const deviceId = `whatsminer-${address.replaceAll('.', '-')}`

const envelope = (type) => ({
  id: `readonly-${type}`,
  version: '0.2.0',
  type: 'request',
  action: 'telemetry.pull',
  sender: 'whatsminer-live-readonly',
  target: 'whatsminer-live-readonly',
  deviceId,
  timestamp: Date.now(),
  payload: { query: { type } }
})

const main = async () => {
  const config = { address, password, account, type: 'miner-wm' }
  if (port !== undefined) config.port = port
  const runtime = new WorkerRuntimeV2(workerDir, {
    workerId: 'whatsminer-live-readonly',
    devices: [{ deviceId, config }]
  })

  try {
    await runtime.start()
    const response = await runtime.handleRequest(envelope('metrics'))
    const metrics = response.payload.metrics
    const failed = Object.entries(metrics).filter(([, value]) => value && typeof value === 'object' && value.error)
    if (failed.length > 0) {
      throw new Error(`ERR_READONLY_CHANNELS_FAILED: ${failed.map(([name, value]) => `${name}=${value.error}`).join(', ')}`)
    }
    console.log(JSON.stringify({
      address,
      requestedPort: port || 'auto',
      apiVersion: metrics.api_version,
      firmware: metrics.firmware_info,
      deviceType: metrics.device_info?.type,
      hashrateRtTHs: metrics.hashrate_rt,
      hashrateAvgTHs: metrics.hashrate_avg,
      powerW: metrics.power,
      temperatureC: metrics.temperature,
      powerMode: metrics.power_mode,
      uptimeS: metrics.uptime,
      hashboards: metrics.hashboards.length,
      pools: metrics.pools.map(pool => ({ url: pool.url, status: pool.status })),
      errors: metrics.errors
    }, null, 2))
  } finally {
    await runtime.stop()
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
