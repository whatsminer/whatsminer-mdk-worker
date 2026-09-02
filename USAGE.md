# WhatsMiner Worker usage

## Runtime configuration

`WorkerRuntimeV2` passes each device's `config` object to this plugin as its ambient device options. Use a unique `deviceId` for each miner. One Worker process may host multiple miners; every device receives an isolated module context and client cache.

For normal deployments, omit `port` and `apiVersion` to prefer API v3 on port 4433 and fall back to API v2 on port 4028. Specify both fields when deterministic protocol selection is required.

Credentials must be supplied by the host's secret-management mechanism. Do not commit passwords, tokens, pool passwords, firmware images, diagnostic archives, or real site inventories.

## Telemetry

The contract exposes these channels:

- Core metrics: `hashrate_rt`, `hashrate_avg`, `power`, `temperature`, `fan_speed_in`, `fan_speed_out`, `status`, `uptime`, `efficiency`, and `power_mode`.
- Pool/share data: `accepted_shares`, `rejected_shares`, `pool_url`, and `pools`.
- Detailed diagnostics: `api_version`, `firmware_info`, `device_info`, `psu_info`, `miner_stats`, `hashboards`, `errors`, and `snap`.

API v3 firmware that does not report accepted or rejected share counts returns zero for those two channels. Pool passwords and API credentials are never returned by telemetry.

For API v3, `pools` merges the configured pool order with the firmware's runtime status. A configured backup that is not present in the runtime response is retained with `status: "unknown"` and `stratum_active: false`; the Worker does not invent an Alive or Dead state. Pool passwords are never cached in this telemetry view.

## Commands

| Command | Main parameter | Physical effect |
| --- | --- | --- |
| `reboot` | None | Restarts the controller. |
| `setPowerMode` | `mode` | Selects `low`, `normal`, `high`, or `sleep`. |
| `setLED` | `enabled` | Enables manual identification blinking or returns the LED to automatic control. |
| `setupPools` | `pools` | Changes active mining destinations. |
| `setPowerPct` | `pct` | Sets 0-200%; values above 100% require supported liquid cooling. |
| `downloadLogs` | None | Returns a Base64 `.tgz` archive with size and SHA-256 metadata. |
| `setNetwork` | `network` | Applies DHCP or static IPv4 configuration and may reboot the controller. |
| `setHostname` | `hostname` | Changes the controller hostname. |
| `updateFirmware` | `firmware` | Validates and uploads an inline Base64 firmware payload. |

The authoritative types, ranges, constraints, errors, and handler paths are in [mdk-contract.json](mdk-contract.json).

## Firmware payload

`updateFirmware` accepts a serializable object:

```json
{
  "filename": "firmware.bin",
  "encoding": "base64",
  "size": 123456,
  "sha256": "64-lowercase-or-uppercase-hex-characters",
  "data": "base64-encoded-bytes"
}
```

The Worker rejects non-canonical Base64, mismatched sizes or hashes, unsafe filenames, empty images, and payloads over the configured limit. The default maximum is 64 MiB.

## Failure semantics

- Read failures surface on the affected telemetry channel.
- Authentication and firmware error strings are stable `ERR_*` values documented by the contract.
- A timeout after a physical write is an unknown result, not permission to retry.
- `setNetwork` and `updateFirmware` use single-attempt paths. Confirm the miner's new address or firmware version before any further action.
- Do not issue `reboot` to an offline miner.

## Mock

Start the bundled API v3 mock on localhost:

```bash
npm run mock
```

The default endpoint is `127.0.0.1:14433` and the mock password is `super`. Override these only for local tests:

```bash
PORT=15433 WHATSMINER_PASSWORD='test-only-password' npm run mock
```
