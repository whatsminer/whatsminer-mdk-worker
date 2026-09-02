'use strict'

const { getDevice } = require('./client')

module.exports = (handler) => async (params = {}) => handler(await getDevice(), params)
