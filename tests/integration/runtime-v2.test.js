'use strict'

const path = require('node:path')
const test = require('brittle')
const { createServer } = require('../../mock/api-v3-server')

const MDK_REPO = process.env.MDK_REPO || path.resolve(__dirname, '../../../mdk')
const WorkerRuntimeV2 = require(path.join(MDK_REPO, 'backend/core/mdk-worker/lib/worker-runtime-v2'))
const { build } = require(path.join(MDK_REPO, 'backend/core/kernel/lib/protocol/envelope'))
const { ACTIONS, MESSAGE_TYPES } = require(path.join(MDK_REPO, 'backend/core/kernel/lib/protocol/actions'))
const WORKER_DIR = path.resolve(__dirname, '../..')

const request = (action, deviceId, payload = {}) => build({
  action,
  type: MESSAGE_TYPES.REQUEST,
  sender: 'runtime-v2-test',
  target: 'whatsminer-test',
  deviceId,
  payload
})

test('WorkerRuntimeV2 loads the standalone package and serves a v3 miner', async (t) => {
  const mock = createServer({ password: 'super' })
  const address = await mock.ready
  const runtime = new WorkerRuntimeV2(WORKER_DIR, {
    workerId: 'whatsminer-test',
    devices: [{
      deviceId: 'wm-v3-0',
      config: {
        address: '127.0.0.1',
        port: address.port,
        apiVersion: '3.0.3',
        account: 'admin',
        password: 'super',
        type: 'miner-wm-m56s'
      }
    }]
  })

  try {
    await runtime.start()

    const identity = await runtime.handleRequest(request(ACTIONS.IDENTITY_REQUEST, null))
    t.is(identity.payload.workerId, 'whatsminer-test')
    t.is(identity.payload.devices[0].deviceId, 'wm-v3-0')

    const capability = await runtime.handleRequest(request(ACTIONS.CAPABILITY_REQUEST, null))
    t.is(capability.payload.contract.metadata.provider, 'microbt')
    t.absent(capability.payload.contract.capabilities.telemetry[0].handler)

    const telemetry = await runtime.handleRequest(request(ACTIONS.TELEMETRY_PULL, 'wm-v3-0', {
      query: { type: 'hashrate_rt' }
    }))
    t.is(telemetry.payload.name, 'hashrate_rt')
    t.is(telemetry.payload.value, 101.84)

    const metrics = await runtime.handleRequest(request(ACTIONS.TELEMETRY_PULL, 'wm-v3-0', {
      query: { type: 'metrics' }
    }))
    t.is(metrics.payload.metrics.api_version, '3.0.3')
    t.is(metrics.payload.metrics.status, 'mining')
    t.is(metrics.payload.metrics.hashboards.length, 1)
    t.is(metrics.payload.metrics.pools[0].url, 'stratum+tcp://pool.example:3333')

    const command = await runtime.handleRequest(request(ACTIONS.COMMAND_REQUEST, 'wm-v3-0', {
      commandId: 'cmd-led-off',
      command: 'setLED',
      params: { enabled: false }
    }))
    t.is(command.payload.status, 'SUCCESS')
    t.is(mock.state.deviceInfo.system.ledstatus, 'auto')

    const invalid = await runtime.handleRequest(request(ACTIONS.COMMAND_REQUEST, 'wm-v3-0', {
      commandId: 'cmd-invalid-power',
      command: 'setPowerPct',
      params: { pct: 201 }
    }))
    t.is(invalid.payload.status, 'FAILED')
    t.is(invalid.payload.error, 'ERR_POWER_PCT_NOT_SUPPORTED')
  } finally {
    await runtime.stop()
    await mock.close()
  }
})
