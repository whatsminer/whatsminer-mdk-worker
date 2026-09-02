'use strict'

const test = require('brittle')
const WMApiV2 = require('../../lib/protocols/wm-api-v2')
const { API_VERSIONS } = require('../../lib/protocols/constants')

const createMockRpc = (responses) => {
  let callIndex = 0
  return {
    request: async (cmd) => {
      const response = responses[callIndex] || responses[0]
      callIndex++
      return JSON.stringify(response)
    }
  }
}

test('protocols/v2-handler - static VERSION', (t) => {
  t.is(WMApiV2.VERSION, API_VERSIONS.V2, 'VERSION should be 2.0.5')
  t.is(WMApiV2.VERSION, '2.0.5', 'VERSION should match string')
})

test('protocols/v2-handler - static DEFAULT_PORT', (t) => {
  t.is(WMApiV2.DEFAULT_PORT, 4028, 'DEFAULT_PORT should be 4028')
})

test('protocols/v2-handler - constructor', (t) => {
  const handler = new WMApiV2({
    rpc: {},
    password: 'testpass'
  })
  t.ok(handler, 'should create handler')
  t.is(handler.password, 'testpass', 'should set password')
  t.is(handler.token, undefined, 'token should be undefined initially')
})

test('protocols/v2-handler - getAuthCommand', (t) => {
  const handler = new WMApiV2({ rpc: {}, password: 'admin' })
  t.is(handler.getAuthCommand(), 'get_token', 'should return get_token')
})

test('protocols/v2-handler - transformCommand returns unchanged', (t) => {
  const handler = new WMApiV2({ rpc: {}, password: 'admin' })

  const commands = [
    'get_token',
    'get_version',
    'summary',
    'pools',
    'update_pools',
    'reboot'
  ]

  for (const cmd of commands) {
    t.is(handler.transformCommand(cmd), cmd, `${cmd} should remain unchanged`)
  }
})

test('protocols/v2-handler - parseResponse returns unchanged', (t) => {
  const handler = new WMApiV2({ rpc: {}, password: 'admin' })

  const response = { Code: 131, Msg: { data: 'test' } }
  t.alike(handler.parseResponse(response, 'cmd'), response, 'should return response unchanged')
})

test('protocols/v2-handler - authenticate success', async (t) => {
  const mockRpc = createMockRpc([{
    Code: 131,
    Msg: {
      time: '0000',
      salt: '5QAHiKMb',
      newsalt: 'kowEj187'
    }
  }])

  const handler = new WMApiV2({
    rpc: mockRpc,
    password: 'admin'
  })

  const token = await handler.authenticate()
  t.ok(token, 'should return token')
  t.ok(token.token, 'should have token string')
  t.ok(token.sign, 'should have sign')
  t.ok(token.key, 'should have key')
  t.ok(handler.token, 'should store token on handler')
})

test('protocols/v2-handler - authenticate IP limit error', async (t) => {
  const mockRpc = createMockRpc([{
    Code: 136
  }])

  const handler = new WMApiV2({
    rpc: mockRpc,
    password: 'admin'
  })

  try {
    await handler.authenticate()
    t.fail('should throw error')
  } catch (error) {
    t.is(error.message, 'ERR_TOKEN_FETCH_IP_LIMIT', 'should throw IP limit error')
  }
})

test('protocols/v2-handler - requestRead success', async (t) => {
  const mockRpc = createMockRpc([{
    Code: 131,
    Msg: { api_ver: '2.0.5' }
  }])

  const handler = new WMApiV2({
    rpc: mockRpc,
    password: 'admin'
  })

  const response = await handler.requestRead('get_version')
  t.ok(response, 'should return response')
  t.is(response.Code, 131, 'should have correct code')
  t.is(response.Msg.api_ver, '2.0.5', 'should have correct data')
})

test('protocols/v2-handler - requestRead with params', async (t) => {
  let capturedCmd
  const mockRpc = {
    request: async (cmd) => {
      capturedCmd = JSON.parse(cmd)
      return JSON.stringify({ Code: 131, Msg: {} })
    }
  }

  const handler = new WMApiV2({
    rpc: mockRpc,
    password: 'admin'
  })

  await handler.requestRead('test_cmd', { param1: 'value1' })
  t.is(capturedCmd.cmd, 'test_cmd', 'should include command')
  t.is(capturedCmd.param1, 'value1', 'should include additional params')
})

test('protocols/v2-handler - requestRead error', async (t) => {
  const mockRpc = {
    request: async () => {
      throw new Error('Connection failed')
    }
  }

  const handler = new WMApiV2({
    rpc: mockRpc,
    password: 'admin'
  })

  try {
    await handler.requestRead('get_version')
    t.fail('should throw error')
  } catch (error) {
    t.is(error.message, 'ERR_READ_FAILED', 'should throw read failed error')
  }
})

test('protocols/v2-handler - getTokenInfo', (t) => {
  const handler = new WMApiV2({ rpc: {}, password: 'admin' })

  t.is(handler.getTokenInfo(), undefined, 'should return undefined when no token')

  handler.token = { token: 'test', sign: 'sign', key: 'key' }
  t.alike(handler.getTokenInfo(), { token: 'test', sign: 'sign', key: 'key' }, 'should return token info')
})

test('protocols/v2-handler - clearToken', (t) => {
  const handler = new WMApiV2({ rpc: {}, password: 'admin' })

  handler.token = { token: 'test', sign: 'sign', key: 'key' }
  t.ok(handler.token, 'should have token')

  handler.clearToken()
  t.is(handler.token, undefined, 'should clear token')
})

test('protocols/v2-handler - _getAPICodeMsg', (t) => {
  const handler = new WMApiV2({ rpc: {}, password: 'admin' })

  t.is(handler._getAPICodeMsg({ Code: 14 }), 'ERR_INVALID_CMD', 'should return correct message for 14')
  t.is(handler._getAPICodeMsg({ Code: 23 }), 'ERR_JSON_CMD', 'should return correct message for 23')
  t.is(handler._getAPICodeMsg({ Code: 45 }), 'ERR_PERMISSION_DENIED', 'should return correct message for 45')
  t.is(handler._getAPICodeMsg({ Code: 131 }), 'OK', 'should return correct message for 131')
  t.is(handler._getAPICodeMsg({ Code: 135 }), 'ERR_TOKEN_EXPIRED', 'should return correct message for 135')
  t.is(handler._getAPICodeMsg({ Code: 136 }), 'ERR_IP_LIMIT', 'should return correct message for 136')
  t.is(handler._getAPICodeMsg({ Code: 999 }), 'ERR_UNKNOWN_CODE_999', 'should return unknown for 999')
})

test('protocols/v2-handler - isResponseOK', (t) => {
  const handler = new WMApiV2({ rpc: {}, password: 'admin' })

  t.ok(handler.isResponseOK({ Code: 131 }), 'should return true for 131')
  t.not(handler.isResponseOK({ Code: 135 }), 'should return false for 135')
  t.not(handler.isResponseOK(null), 'should return false for null')
})
