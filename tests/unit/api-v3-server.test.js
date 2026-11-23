'use strict'

const test = require('brittle')
const { DEFAULT_STATE, createServer } = require('../../mock/api-v3-server')

test('each createServer() instance owns its state', async (t) => {
  const a = createServer({ password: 'super' })
  const b = createServer({ password: 'super', state: { deviceInfo: { miner: { 'miner-sn': 'B-SN' } } } })
  await Promise.all([a.ready, b.ready])
  t.teardown(async () => {
    await a.close()
    await b.close()
  })

  t.not(a.state.summary, b.state.summary)
  t.not(a.state.pools, b.state.pools)
  t.not(a.state.edevs, b.state.edevs)
  t.not(a.state.setting, b.state.setting)
  t.not(a.state.summary, DEFAULT_STATE.summary)

  a.state.summary.elapsed = 1
  a.state.summary['power-on-stats']['energy-ws'] = 0
  a.state.pools.push({ url: 'stratum+tcp://pool.example:3333' })
  a.state.setting['power-mode'] = 'high'
  a.state.deviceInfo.miner['miner-sn'] = 'A-SN'

  t.is(b.state.summary.elapsed, DEFAULT_STATE.summary.elapsed)
  t.is(b.state.summary['power-on-stats']['energy-ws'], DEFAULT_STATE.summary['power-on-stats']['energy-ws'])
  t.is(b.state.pools.length, DEFAULT_STATE.pools.length)
  t.is(b.state.setting['power-mode'], DEFAULT_STATE.setting['power-mode'])
  t.is(b.state.deviceInfo.miner['miner-sn'], 'B-SN')
  t.is(DEFAULT_STATE.summary.elapsed, 1074, 'the defaults themselves are untouched')
  t.ok(Buffer.isBuffer(a.state.logData))
})
