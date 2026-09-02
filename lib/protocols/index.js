'use strict'

const WMApiV2 = require('./wm-api-v2')
const WMApiV3 = require('./wm-api-v3')
const { API_VERSIONS, DEFAULT_API_VERSION, API_DEFAULTS } = require('./constants')

const HANDLERS = {
  2: WMApiV2,
  3: WMApiV3
}

const MAJOR_TO_CANONICAL = {
  2: API_VERSIONS.V2,
  3: API_VERSIONS.V3
}

/**
 * Factory for creating protocol handlers based on API version.
 * Any version string is resolved by major version ('2.2.2' → V2 handler).
 */
class ApiHandlerFactory {
  static getMajorVersion (version) {
    if (!version || typeof version !== 'string') return null
    const match = version.match(/^(\d+)/)
    return match ? parseInt(match[1], 10) : null
  }

  static normalizeVersion (version) {
    const major = ApiHandlerFactory.getMajorVersion(version)
    return MAJOR_TO_CANONICAL[major] || DEFAULT_API_VERSION
  }

  static create (version, opts) {
    const major = ApiHandlerFactory.getMajorVersion(version)
    const HandlerClass = HANDLERS[major]
    if (!HandlerClass) {
      throw new Error(`ERR_UNSUPPORTED_API_VERSION: ${version}`)
    }
    return new HandlerClass(opts)
  }

  static getSupportedVersions () {
    return Object.values(MAJOR_TO_CANONICAL)
  }

  static getHandlerClass (version) {
    const major = ApiHandlerFactory.getMajorVersion(version)
    return HANDLERS[major]
  }

  static getDefaultPort (version) {
    const canonical = ApiHandlerFactory.normalizeVersion(version)
    return API_DEFAULTS[canonical]?.port || API_DEFAULTS[DEFAULT_API_VERSION].port
  }

  static isVersionSupported (version) {
    const major = ApiHandlerFactory.getMajorVersion(version)
    return major in HANDLERS
  }
}

module.exports = {
  ApiHandlerFactory,
  WMApiV2,
  WMApiV3,
  API_VERSIONS,
  DEFAULT_API_VERSION,
  API_DEFAULTS
}
