'use strict'

const test = require('brittle')
const WMApiBase = require('../../lib/protocols/wm-api-base')

test('protocols/base-handler - cannot instantiate directly', (t) => {
  try {
    const handler = new WMApiBase({}) // eslint-disable-line no-unused-vars
    t.fail('should throw error when instantiated directly')
  } catch (error) {
    t.ok(error.message.includes('abstract class'), 'should throw abstract class error')
  }
})

test('protocols/base-handler - VERSION throws error', (t) => {
  try {
    const version = WMApiBase.VERSION // eslint-disable-line no-unused-vars
    t.fail('should throw error for VERSION')
  } catch (error) {
    t.ok(error.message.includes('must be implemented'), 'should require implementation')
  }
})

test('protocols/base-handler - DEFAULT_PORT throws error', (t) => {
  try {
    const port = WMApiBase.DEFAULT_PORT // eslint-disable-line no-unused-vars
    t.fail('should throw error for DEFAULT_PORT')
  } catch (error) {
    t.ok(error.message.includes('must be implemented'), 'should require implementation')
  }
})

class TestHandler extends WMApiBase {
  static get VERSION () { return 'test' }
  static get DEFAULT_PORT () { return 1234 }
  getAuthCommand () { return 'test_auth' }
  async authenticate () { return { token: 'test' } }
  async requestRead (cmd) { return { cmd } }
  async requestWrite (cmd) { return { cmd } }
}

test('protocols/base-handler - subclass can extend', (t) => {
  const handler = new TestHandler({ rpc: {}, password: 'test' })
  t.ok(handler, 'should create handler instance')
  t.is(handler.password, 'test', 'should set password')
})

test('protocols/base-handler - subclass static properties', (t) => {
  t.is(TestHandler.VERSION, 'test', 'should return VERSION')
  t.is(TestHandler.DEFAULT_PORT, 1234, 'should return DEFAULT_PORT')
})

test('protocols/base-handler - subclass methods', async (t) => {
  const handler = new TestHandler({ rpc: {}, password: 'test' })

  const auth = await handler.authenticate()
  t.alike(auth, { token: 'test' }, 'authenticate should work')

  const read = await handler.requestRead('test_cmd')
  t.alike(read, { cmd: 'test_cmd' }, 'requestRead should work')

  const write = await handler.requestWrite('test_cmd')
  t.alike(write, { cmd: 'test_cmd' }, 'requestWrite should work')

  t.is(handler.getAuthCommand(), 'test_auth', 'getAuthCommand should work')
})

test('protocols/base-handler - transformCommand default', (t) => {
  const handler = new TestHandler({ rpc: {}, password: 'test' })
  t.is(handler.transformCommand('test'), 'test', 'should return command unchanged by default')
})

test('protocols/base-handler - parseResponse default', (t) => {
  const handler = new TestHandler({ rpc: {}, password: 'test' })
  const response = { data: 'test' }
  t.alike(handler.parseResponse(response, 'cmd'), response, 'should return response unchanged by default')
})

test('protocols/base-handler - isResponseOK', (t) => {
  const handler = new TestHandler({ rpc: {}, password: 'test' })
  t.ok(handler.isResponseOK({ Code: 131 }), 'should return true for Code 131')
  t.not(handler.isResponseOK({ Code: 135 }), 'should return false for Code 135')
  t.not(handler.isResponseOK({ Code: 136 }), 'should return false for Code 136')
  t.not(handler.isResponseOK(null), 'should return false for null')
  t.not(handler.isResponseOK(undefined), 'should return false for undefined')
  t.not(handler.isResponseOK({}), 'should return false for empty object')
})

test('protocols/base-handler - debugError default', (t) => {
  const handler = new TestHandler({ rpc: {}, password: 'test' })
  handler.debugError('test message')
  t.ok(true, 'debugError should not throw with default')
})

test('protocols/base-handler - debugError custom', (t) => {
  const messages = []
  const handler = new TestHandler({
    rpc: {},
    password: 'test',
    debugError: (msg) => messages.push(msg)
  })
  handler.debugError('test message')
  t.is(messages.length, 1, 'should call custom debugError')
  t.is(messages[0], 'test message', 'should pass message correctly')
})
