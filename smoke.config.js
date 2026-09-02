'use strict'

const { createServer } = require('./mock/api-v3-server')

module.exports = {
  async setup () {
    const mock = createServer({ password: 'super' })
    const address = await mock.ready
    return {
      config: {
        address: '127.0.0.1',
        port: address.port,
        apiVersion: '3.0.3',
        account: 'admin',
        password: 'super',
        type: 'miner-wm-m56s'
      },
      commands: {
        setLED: { enabled: false },
        setPowerMode: { mode: 'normal' },
        setPowerPct: { pct: 100 },
        setupPools: {
          pools: [{ url: 'stratum+tcp://pool.example:3333', worker_name: 'worker', worker_password: 'x' }]
        },
        setNetwork: { network: { dhcp: true } },
        setHostname: { hostname: 'whatsminer-test' },
        downloadLogs: {}
      },
      teardown: () => mock.close()
    }
  }
}
