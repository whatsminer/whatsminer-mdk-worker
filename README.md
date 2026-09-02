# WhatsMiner MDK Worker

Official MicroBT WhatsMiner Worker plugin for Tether MDK. The package is loaded directly from this directory by MDK's `WorkerRuntimeV2`; it does not bundle a Kernel or a process supervisor.

The Worker supports both firmware API generations:

| API | Default port | Authentication |
| --- | ---: | --- |
| v3 | `4433` | Per-command SHA-256 token with encrypted sensitive parameters |
| v2 | `4028` | Salted MD5-crypt token with AES-encrypted write commands |

When `port` and `apiVersion` are omitted, the Worker probes API v3 first and then falls back to API v2. Compatibility is based on the firmware API, not on a fixed miner-model allowlist.

## Requirements

- Node.js 24 or newer
- A Tether MDK checkout containing `WorkerRuntimeV2`
- Network access from the Worker host to the miner's API port
- A WhatsMiner API account and password

Until `@tetherto/mdk-worker` is published separately, follow Tether's `Test a Worker with MDK` guide to install the MDK monorepo and its core dependencies.

## Host the Worker

```js
'use strict'

const path = require('node:path')
const { WorkerRuntimeV2 } = require('@tetherto/mdk/backend/core/mdk-worker')

const runtime = new WorkerRuntimeV2(path.resolve('/path/to/whatsminer-mdk-worker'), {
  workerId: 'whatsminer-rack-1',
  devices: [{
    deviceId: 'wm-001',
    config: {
      address: '192.168.1.10',
      password: process.env.WHATSMINER_PASSWORD,
      account: 'admin'
    }
  }]
})

await runtime.start()
```

Device configuration fields:

| Field | Required | Description |
| --- | --- | --- |
| `address` | Yes | Miner IPv4 address or hostname. `host` is accepted as an alias. |
| `password` | Yes | WhatsMiner API password. Keep it outside source control. |
| `account` | API v3 only | API account; commonly `admin`. |
| `port` | No | `4433`, `4028`, or a custom API port. Omit for auto-detection. |
| `apiVersion` | No | `3.0.3` or `2.0.5`. Firmware minor versions within the same major generation are accepted. |
| `type` | No | Cooling/model profile such as `miner-wm-m56s`. |
| `conf` | No | Timeouts, configured pools, and firmware/log size limits. |

See [USAGE.md](USAGE.md) and [mdk-contract.json](mdk-contract.json) for telemetry, command, and safety details.

## Test

With this repository and `mdk` checked out as sibling directories:

```bash
npm install
MDK_REPO=../mdk npm test
```

The test suite covers protocol authentication and framing, API v2/v3 normalization, firmware payload validation, contract handler loading, mock-device behavior, and WorkerRuntimeV2 envelope dispatch.

Run the read-only live-device check without placing the password in the command line or repository:

```bash
WHATSMINER_PASSWORD='your-api-password' node scripts/test-live-readonly.js 192.168.1.10
WHATSMINER_PASSWORD='your-api-password' node scripts/test-live-readonly.js 192.168.1.10 4433
WHATSMINER_PASSWORD='your-api-password' node scripts/test-live-readonly.js 192.168.1.10 4028
```

This script only requests telemetry. It does not invoke `set.*`, reboot, pool, network, or firmware commands.

On controlled test hardware with API writes explicitly enabled, validate the reversible LED command and its rollback:

```bash
WHATSMINER_PASSWORD='your-api-password' node scripts/test-live-led.js 192.168.1.10 4433
WHATSMINER_PASSWORD='your-api-password' node scripts/test-live-led.js 192.168.1.10 4028
```

The script records the LED state, enables identification flashing, confirms the changed state, restores automatic LED control, and confirms the rollback. It does not change power, pools, network settings, hostname, or firmware. API write access remains controlled by the miner and must not be left enabled after testing.

## Safety

Commands can change physical miner state. Network and firmware operations can make a device unreachable. Write requests are never automatically retried when a timeout or connection reset leaves the physical outcome unknown. Validate writes against the bundled mock before using controlled test hardware.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
