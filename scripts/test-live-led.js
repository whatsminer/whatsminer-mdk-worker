'use strict'

const path = require('node:path')

const address = process.argv[2]
const port = process.argv[3] ? Number(process.argv[3]) : undefined
const apiVersion = process.env.WHATSMINER_API_VERSION
const password = process.env.WHATSMINER_PASSWORD
const account = process.env.WHATSMINER_ACCOUNT || 'admin'
const mdkRepo = process.env.MDK_REPO
  ? path.resolve(process.env.MDK_REPO)
  : path.resolve(__dirname, '../../mdk')

if (!address || !password || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('usage: WHATSMINER_PASSWORD=... node scripts/test-live-led.js <address> <port>')
  process.exit(1)
}

const WorkerRuntimeV2 = require(path.join(mdkRepo, 'backend/core/mdk-worker/lib/worker-runtime-v2'))
const workerDir = path.resolve(__dirname, '..')
const deviceId = `whatsminer-${address.replaceAll('.', '-')}-${port}`
let sequence = 0

const envelope = (action, payload) => ({
  id: `live-led-${port}-${++sequence}`,
  version: '0.2.0',
  type: 'request',
  action,
  sender: 'whatsminer-live-led-test',
  target: 'whatsminer-live-led-test',
  deviceId,
  timestamp: Date.now(),
  payload
})

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const main = async () => {
  const runtime = new WorkerRuntimeV2(workerDir, {
    workerId: 'whatsminer-live-led-test',
    devices: [{
      deviceId,
      config: { address, port, apiVersion, password, account, type: 'miner-wm' }
    }]
  })
  let restoreNeeded = false

  const readLedState = async () => {
    const response = await runtime.handleRequest(envelope('telemetry.pull', {
      query: { type: 'device_info' }
    }))
    return response.payload.value.ledstat ?? response.payload.value.led_mode
  }

  const setLED = async (enabled) => {
    const response = await runtime.handleRequest(envelope('command.request', {
      commandId: `live-led-${port}-${enabled ? 'on' : 'auto'}-${sequence + 1}`,
      command: 'setLED',
      params: { enabled }
    }))
    if (response.payload.status !== 'SUCCESS') {
      throw new Error(response.payload.error || 'ERR_COMMAND_FAILED')
    }
    return response.payload.status
  }

  try {
    await runtime.start()
    const before = await readLedState()
    restoreNeeded = true
    const enableStatus = await setLED(true)
    await wait(5500)
    const enabled = await readLedState()
    const restoreStatus = await setLED(false)
    restoreNeeded = false
    await wait(5500)
    const restored = await readLedState()

    if (String(restored).toLowerCase() !== 'auto') {
      throw new Error(`ERR_LED_RESTORE_NOT_CONFIRMED: ${restored}`)
    }

    console.log(JSON.stringify({
      address,
      port,
      before,
      enableStatus,
      enabled,
      restoreStatus,
      restored
    }, null, 2))
  } finally {
    if (restoreNeeded) {
      try {
        await setLED(false)
      } catch (error) {
        console.error(`LED restore failed: ${error.message}`)
      }
    }
    await runtime.stop()
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
