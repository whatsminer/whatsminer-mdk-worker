'use strict'

const EventEmitter = require('node:events')
const debug = require('debug')

const sumPoolsShares = (pools, key) => pools.reduce((total, pool) => total + (parseInt(pool[key], 10) || 0), 0)

class MinerBase extends EventEmitter {
  constructor ({ lastSeenTimeout = 30000, conf = {}, ...opts } = {}) {
    super()
    this._lastSeen = null
    this._errorLog = []
    this.debug = debug('whatsminer:device')
    this.conf = conf
    this.opts = {
      lastSeenTimeout,
      timeout: conf.timeout || 10000,
      ...opts
    }
    this.lastSnap = null
    this.deviceDataCache = {}
    this.cachedShares = { accepted: 0, rejected: 0, stale: 0 }
  }

  debugError (data, error) {
    this.debug(data, error)
  }

  updateLastSeen () {
    this._lastSeen = Date.now()
  }

  isThingOnline () {
    return this._lastSeen !== null && Date.now() - this._lastSeen < this.opts.lastSeenTimeout
  }

  validateWriteAction (action, ...args) {
    if (action === 'setLED' && typeof args[0] !== 'boolean') {
      throw new Error('ERR_SET_LED_ENABLED_INVALID')
    }
    return 1
  }

  checkSamePools (newPools, oldPools) {
    if (newPools.length !== oldPools.length) return false
    return newPools.every((pool) => {
      const oldPool = oldPools.find(item => item.url === pool.url)
      return oldPool !== undefined && pool.worker_name === oldPool.username
    })
  }

  preProcessPoolData (pools, appendId = true) {
    if (!Array.isArray(pools)) throw new Error('ERR_INVALID_ARG_TYPE')
    const prepared = appendId
      ? pools.map(pool => ({ ...pool, worker_name: `${pool.worker_name}.${this.opts.id}` }))
      : pools.map(pool => ({ ...pool }))
    while (prepared.length < 3) {
      prepared.push({ url: '', worker_name: '', worker_password: '' })
    }
    return prepared
  }

  _prepPools (pools, appendId, oldPools) {
    const prepared = this.preProcessPoolData(pools, appendId)
    return oldPools && this.checkSamePools(prepared, oldPools) ? false : prepared
  }

  async setupPools () {
    try {
      await this.setPools(this.conf.pools, true)
      return { success: true }
    } catch (error) {
      return { success: false, error_msg: error.message }
    }
  }

  // Concurrent callers of the same read share one in-flight request. Nothing is
  // kept once it settles, so after the device stops the next read fails instead
  // of serving a stale value.
  fetchDeviceData (fn) {
    const key = fn.name
    let pending = this.deviceDataCache[key]
    if (!pending) {
      pending = Promise.resolve().then(() => fn.call(this)).finally(() => {
        if (this.deviceDataCache[key] === pending) delete this.deviceDataCache[key]
      })
      this.deviceDataCache[key] = pending
    }
    return pending
  }

  _handleErrorUpdates (errors) {
    this._errorLog.length = 0
    this._errorLog.push(...errors)
  }

  _calcNewShares (pools) {
    if (!Array.isArray(pools) || pools.length === 0) {
      return { accepted: 0, rejected: 0, stale: 0 }
    }
    const current = {
      accepted: sumPoolsShares(pools, 'accepted'),
      rejected: sumPoolsShares(pools, 'rejected'),
      stale: sumPoolsShares(pools, 'stale')
    }
    const added = Object.fromEntries(Object.entries(current).map(([key, value]) => [
      key,
      value >= this.cachedShares[key] ? value - this.cachedShares[key] : value
    ]))
    this.cachedShares = { ...current }
    return added
  }

  async getSnap () {
    let snap
    try {
      const data = await this._prepSnap()
      snap = { success: true, raw_errors: this._errorLog, stats: data.stats, config: data.config }
    } catch (error) {
      this.debugError('getSnap error', error)
      snap = this.isThingOnline() && error.message !== 'ERR_OFFLINE'
        ? { success: false, stats: { status: 'error', errors: [{ msg: error.message, timestamp: Date.now() }] } }
        : { success: false, stats: { status: 'offline' } }
    }
    this.lastSnap = snap
    return snap
  }
}

module.exports = MinerBase
