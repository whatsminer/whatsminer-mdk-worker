'use strict'

const net = require('node:net')

class TcpRpc {
  constructor ({ host, port, timeout = 10000, encoding = 'utf8' }) {
    this.host = host
    this.port = port
    this.timeout = timeout
    this.encoding = encoding
    this.sockets = new Set()
  }

  request (payload) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port })
      this.sockets.add(socket)
      const chunks = []
      let settled = false

      const finish = (error) => {
        if (settled) return
        settled = true
        this.sockets.delete(socket)
        socket.destroy()
        if (error) reject(error)
        else resolve(Buffer.concat(chunks).toString(this.encoding))
      }

      socket.setTimeout(this.timeout)
      socket.once('connect', () => socket.end(payload))
      socket.on('data', chunk => chunks.push(chunk))
      socket.once('end', () => finish())
      socket.once('timeout', () => finish(new Error('ERR_API_V2_TIMEOUT')))
      socket.once('error', () => finish(new Error('ERR_API_V2_CONNECTION')))
    })
  }

  async stop () {
    for (const socket of this.sockets) socket.destroy()
    this.sockets.clear()
  }
}

module.exports = TcpRpc
