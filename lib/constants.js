'use strict'

const STATUS = {
  OFFLINE: 'offline',
  SLEEPING: 'sleeping',
  MINING: 'mining',
  ERROR: 'error',
  NOT_MINING: 'not_mining'
}

const POWER_MODE = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  SLEEP: 'sleep'
}

module.exports = { STATUS, POWER_MODE }
