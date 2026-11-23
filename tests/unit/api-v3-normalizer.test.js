'use strict'

const test = require('brittle')
const WhatsminerApiV3Client = require('../../lib/whatsminer-api-v3-client')
const WhatsminerApiV2Client = require('../../lib/whatsminer-api-v2-client')

function createClient (responses, opts = {}) {
  const client = new WhatsminerApiV3Client({
    address: '127.0.0.1',
    port: 4433,
    password: 'super',
    type: 'miner-wm-m50s',
    id: 'WM-V3',
    ...opts
  })
  client.protocol.requestRead = async (command, params) => ({
    code: 0,
    msg: responses[`${command}:${params.param || ''}`] ?? responses[command]
  })
  return client
}

test('api-v3 client - is a plain device client, not a legacy Miner subclass', (t) => {
  const client = createClient({})
  t.ok(client instanceof WhatsminerApiV3Client)
  t.not(client instanceof WhatsminerApiV2Client)
  t.is(Object.getPrototypeOf(WhatsminerApiV3Client.prototype), Object.prototype)
})

test('api-v3 client - normalizes native status and settings for handlers', async (t) => {
  const client = createClient({
    'get.miner.status:summary+pools': {
      summary: {
        elapsed: 100,
        'hash-average': 101.847,
        'hash-realtime': 102.125,
        'power-5min': 3247.641,
        'board-temperature': [69.6],
        'chip-temp-avg': 92.9,
        'fan-speed-in': 4980,
        'fan-speed-out': 5070
      },
      pools: [{ id: 1, url: 'stratum+tcp://pool:3333', accepted: 42, rejected: 2 }]
    },
    'get.miner.setting': { 'power-mode': 'high' }
  })

  const stats = await client.getMinerStats()
  t.is(stats.mhs_av, 101847000)
  t.is(stats.hs_rt, 102125000)
  t.absent('mhs_5s' in stats)
  t.absent('mhs_5m' in stats)
  t.is(stats.temperature, 92.9)
  t.alike(stats.board_temperature, [69.6])
  t.is(stats.accepted, 42)
  t.is(stats.rejected, 2)
  t.is(stats.power_mode, 'high')
})

test('api-v3 client - resumes mining before changing power mode', async (t) => {
  const client = createClient({})
  const calls = []
  client.protocol.requestWrite = async (command, params) => {
    calls.push({ command, param: params.param })
    return { code: 0, msg: 'ok' }
  }

  t.alike(await client.setPowerMode('normal'), { success: true })
  t.alike(calls, [
    { command: 'set.miner.service', param: 'start' },
    { command: 'set.miner.power_mode', param: 'normal' }
  ])
})

test('api-v3 client - does not invent share counts omitted by firmware', async (t) => {
  const client = createClient({
    'get.miner.status:summary+pools': {
      summary: { elapsed: 100 },
      pools: [{ id: 1, 'reject-percent': 4.5 }]
    },
    'get.miner.setting': {}
  })

  const stats = await client.getMinerStats()
  t.is(stats.accepted, undefined)
  t.is(stats.rejected, undefined)
})

test('api-v3 client - treats an idle pools-only ERR_FAIL as an empty pool list', async (t) => {
  const client = createClient({
    'get.miner.status:summary+pools': { summary: { elapsed: 100 } }
  })
  const requestRead = client.protocol.requestRead
  client.protocol.requestRead = async (command, params) => {
    if (command === 'get.miner.status' && params.param === 'pools') throw new Error('ERR_FAIL')
    return requestRead(command, params)
  }

  t.alike(await client.getPools(), [])
})

test('api-v3 client - does not hide non-idle pool query failures', async (t) => {
  const client = createClient({})
  client.protocol.requestRead = async () => { throw new Error('ERR_API_V3_TIMEOUT') }

  await t.exception(client.getPools(), /ERR_API_V3_TIMEOUT/)
})

test('api-v3 client - merges configured backup pools with runtime status', async (t) => {
  const client = createClient({
    'get.miner.status:pools': {
      pools: [{
        id: 1,
        url: 'stratum+tcp://primary:3333',
        account: 'worker.primary',
        status: 'alive',
        'stratum-active': true,
        'stratum-diff': 16384
      }]
    }
  }, {
    conf: {
      pools: [
        { url: 'stratum+tcp://primary:3333', worker_name: 'worker.primary', worker_password: 'secret-1' },
        { url: 'stratum+tcp://backup:3333', worker_name: 'worker.backup', worker_password: 'secret-2' }
      ]
    }
  })

  const pools = await client.getPools()
  t.is(pools.length, 2)
  t.is(pools[0].status, 'alive')
  t.is(pools[0].stratum_active, true)
  t.is(pools[0].stratum_difficulty, 16384)
  t.is(pools[1].url, 'stratum+tcp://backup:3333')
  t.is(pools[1].user, 'worker.backup')
  t.is(pools[1].status, 'unknown')
  t.is(pools[1].stratum_active, false)
  t.absent(pools[0].worker_password)
  t.absent(pools[1].worker_password)
})

test('api-v3 client - successful pool write updates configured view without passwords', async (t) => {
  const client = createClient({
    'get.miner.status:pools': {
      pools: [{ id: 1, url: 'stratum+tcp://primary:3333', status: 'alive' }]
    }
  })
  client.protocol.requestWrite = async () => ({ code: 0, msg: 'ok' })

  const result = await client.setPools([
    { url: 'stratum+tcp://primary:3333', worker_name: 'worker.primary', worker_password: 'secret-1' },
    { url: 'stratum+tcp://backup:3333', worker_name: 'worker.backup', worker_password: 'secret-2' }
  ], false)

  t.alike(result, { success: true })
  const pools = await client.getPools()
  t.is(pools.length, 2)
  t.is(pools[1].url, 'stratum+tcp://backup:3333')
  t.is(pools[1].status, 'unknown')
  t.absent(pools[0].worker_password)
  t.absent(pools[1].worker_password)
})

test('api-v3 client - failed pool write preserves configured view', async (t) => {
  const client = createClient({}, {
    conf: {
      pools: [{ url: 'stratum+tcp://original:3333', worker_name: 'worker.original', worker_password: 'secret' }]
    }
  })
  client.protocol.requestWrite = async () => { throw new Error('ERR_FAIL') }

  const result = await client.setPools([
    { url: 'stratum+tcp://replacement:3333', worker_name: 'worker.replacement', worker_password: 'replacement-secret' }
  ], false)

  t.alike(result, { success: false, error_msg: 'ERR_FAIL' })
  t.is(client.configuredPools.length, 1)
  t.is(client.configuredPools[0].url, 'stratum+tcp://original:3333')
  t.absent(client.configuredPools[0].worker_password)
})

test('api-v3 client - normalizes native device identity and version', async (t) => {
  const client = createClient({
    'get.device.info:': {
      network: { hostname: 'WhatsMiner', mac: '00:11:22:33:44:55' },
      miner: { 'miner-sn': 'MINER-SN', type: 'M50S' },
      system: { ledstatus: 'auto', api: '3.0.3', platform: 'H616', fwversion: '20260819.01' },
      power: { sn: 'PSU-SN' }
    },
    'get.device.info:system': {
      system: { api: '3.0.3', platform: 'H616', fwversion: '20260819.01' }
    },
    'get.miner.setting': { 'upfreq-speed': 2 }
  })

  const [info, version] = await Promise.all([client.getMinerInfo(), client.getVersion()])
  t.is(info.hostname, 'WhatsMiner')
  t.is(info.mac, '00:11:22:33:44:55')
  t.is(info.minersn, 'MINER-SN')
  t.is(info.powersn, 'PSU-SN')
  t.is(info.upfreq_speed, 2)
  t.is(version.whatsminer.api, '3.0.3')
  t.is(version.platform, 'H616')
})

test('api-v3 client - getMinerInfo exposes the settings the status view needs', async (t) => {
  const client = createClient({
    'get.device.info:': {
      miner: { working: 'true', 'hash-percent': '0', 'power-limit-set': '99999' },
      system: { ledstatus: 'auto' }
    },
    'get.miner.setting': { 'power-mode': 'normal', 'fast-hash': 'disable', 'upfreq-speed': 0 }
  })

  const info = await client.getMinerInfo()
  t.is(info.power_mode_setting, 'normal')
  t.is(info.fast_hash, 'disable')
  t.is(info.working, 'true')
})

test('api-v3 client - snap carries the v2-shaped status under miner_specific', async (t) => {
  const client = createClient({})
  client.getMinerStats = async () => ({ mhs_av: 404289000, power: 7485.85, power_mode: 'normal' })
  client.getPools = async () => []
  client.getDevices = async () => []
  client.getErrors = async () => []
  client.getMinerInfo = async () => ({
    proto: 'dhcp',
    dns: '10.0.44.1',
    ledstat: 'auto',
    upfreq_speed: 0,
    working: 'true',
    'hash-percent': '0',
    'power-limit-set': '99999',
    power_mode_setting: 'normal',
    fast_hash: 'disable'
  })
  client.getVersion = async () => ({ whatsminer: { api: '3.0.5', firmware: '20260908.12.Rel2' } })

  const snap = await client.getSnap()
  t.is(snap.success, true)
  t.alike(snap.stats.miner_specific.status, {
    mineroff: 'false',
    FirmwareVersion: '20260908.12.Rel2',
    power_mode: 'normal',
    power_limit_set: '99999',
    hash_percent: '0',
    fast_hash: 'false'
  })
})

test('api-v3 client - status view reports a stopped miner and omits fields firmware did not send', (t) => {
  const client = createClient({})
  const status = client._minerStatus({ working: 'false', fast_hash: 'enable' }, { whatsminer: { firmware: 'FW' } })
  t.is(status.mineroff, 'true')
  t.is(status.fast_hash, 'true')
  t.is(status.FirmwareVersion, 'FW')
  t.is(status.power_mode, undefined)
  t.is(status.power_limit_set, undefined)
  t.is(status.hash_percent, undefined)

  const unknown = client._minerStatus({}, { whatsminer: { firmware: 'FW' } })
  t.is(unknown.mineroff, undefined)
  t.is(unknown.fast_hash, undefined)
})
