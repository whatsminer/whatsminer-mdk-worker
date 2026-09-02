'use strict'

const { createServer } = require('../mock/api-v3-server')

const port = Number(process.env.PORT || process.argv[2] || 14433)
const mock = createServer({ host: '127.0.0.1', port, password: process.env.WHATSMINER_PASSWORD || 'super' })

mock.ready.then(address => {
  console.log(`WhatsMiner API v3 mock listening on ${address.address}:${address.port}`)
})

const stop = async () => {
  await mock.close()
  process.exit(0)
}

process.once('SIGINT', stop)
process.once('SIGTERM', stop)
