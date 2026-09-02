'use strict'

const { id, opts, logger } = require('@tetherto/mdk-worker/device')
const WhatsminerApiV2Client = require('../lib/whatsminer-api-v2-client')
const WhatsminerApiV3Client = require('../lib/whatsminer-api-v3-client')
const TcpRpc = require('../lib/tcp-rpc')
const { ApiHandlerFactory, API_VERSIONS } = require('../lib/protocols')
const { DEFAULT_NOMINAL_EFFICIENCY_WTHS } = require('../lib/utils/constants')

let devicePromise

const deviceConfig = () => {
  const address = opts.address || opts.host
  const type = opts.type || (opts.model ? `miner-wm-${opts.model}` : 'miner-wm')
  if (!address || !opts.password) throw new Error('ERR_DEVICE_CONFIG_INVALID')
  if (opts.apiVersion && !ApiHandlerFactory.isVersionSupported(opts.apiVersion)) {
    throw new Error(`ERR_UNSUPPORTED_API_VERSION: ${opts.apiVersion}`)
  }
  return {
    ...opts,
    address,
    conf: opts.conf || {},
    id,
    type,
    nominalEfficiencyWThs: opts.nominalEfficiencyWThs ||
      DEFAULT_NOMINAL_EFFICIENCY_WTHS[type] || 0
  }
}

const createDevice = (config, { port, apiVersion }) => {
  const clientOpts = { ...config, port, apiVersion }
  const device = ApiHandlerFactory.getMajorVersion(apiVersion) === 3
    ? new WhatsminerApiV3Client(clientOpts)
    : new WhatsminerApiV2Client({
      ...clientOpts,
      socketer: {
        rpc: ({ tcpOpts, timeout }) => new TcpRpc({ ...tcpOpts, timeout })
      }
    })
  device.on('error', error => logger('device %s error: %s', id, error.message))
  return device
}

const candidatesFor = (config) => {
  if (config.apiVersion) {
    return [{
      port: config.port || ApiHandlerFactory.getDefaultPort(config.apiVersion),
      apiVersion: config.apiVersion
    }]
  }
  if (!config.port) {
    return [
      { port: 4433, apiVersion: API_VERSIONS.V3 },
      { port: 4028, apiVersion: API_VERSIONS.V2 }
    ]
  }
  if (config.port === 4433) return [{ port: 4433, apiVersion: API_VERSIONS.V3 }]
  if (config.port === 4028) return [{ port: 4028, apiVersion: API_VERSIONS.V2 }]
  if (config.probe === false) throw new Error('ERR_API_VERSION_REQUIRED_FOR_CUSTOM_PORT')
  return [
    { port: config.port, apiVersion: API_VERSIONS.V3 },
    { port: config.port, apiVersion: API_VERSIONS.V2 }
  ]
}

const connect = async () => {
  const config = deviceConfig()
  let lastError
  for (const candidate of candidatesFor(config)) {
    const device = createDevice(config, candidate)
    try {
      await device.getVersion()
      logger('device %s connected through API %s on %s:%d', id, candidate.apiVersion, config.address, candidate.port)
      return device
    } catch (error) {
      lastError = error
      logger('device %s probe failed through API %s on port %d: %s', id, candidate.apiVersion, candidate.port, error.message)
      await device.close().catch(() => {})
    }
  }
  throw lastError || new Error('ERR_DEVICE_CONNECTION_FAILED')
}

const getDevice = () => {
  if (!devicePromise) {
    devicePromise = connect().catch(error => {
      devicePromise = null
      throw error
    })
  }
  return devicePromise
}

module.exports = { getDevice }
