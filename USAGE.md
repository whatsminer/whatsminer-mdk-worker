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

`snap` includes the miner's run state under `stats.miner_specific.status`.

- **API v2:** this is the firmware's `status` reply, passed through as-is, so its keys and value types are whatever the firmware sends. Current firmware reports `mineroff`, `mineroff_reason`, `mineroff_time`, `FirmwareVersion`, `power_mode`, `power_limit_set`, `hash_percent`, `fast_mining`, `fast_hash`, and `liquid_temp`. Older firmware, as documented in the official API v2 manuals, uses `btmineroff` and `Firmware Version` instead of `mineroff` and `FirmwareVersion`. Most values are strings (`"false"`, `"99999"`), but `liquid_temp` is a number (for example `30.562`). If the firmware answers `status` with an error (for example Code 132 "This command is deprecated."), `status` is `undefined`.
- **API v3:** there is no `status` command, so the Worker rebuilds a subset from `get.device.info` and `get.miner.setting` using the current v2 key names: `mineroff` and `fast_hash` (as `"true"`/`"false"` strings), `FirmwareVersion`, `power_mode`, `power_limit_set`, and `hash_percent`. `mineroff_reason`, `mineroff_time`, `fast_mining`, and `liquid_temp` have no v3 source and are always omitted, and any other field the firmware does not report is omitted rather than defaulted.

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
- Exception: on API v2, a failed or rejected `status` read does not fail `snap`. The snapshot is returned with `stats.miner_specific.status` undefined, so firmware without the `status` command still reports.
- Authentication and firmware error strings are stable `ERR_*` values documented by the contract.
- Command parameters are validated by the MDK runtime against `mdk-contract.json` before the Worker runs. Out-of-range values fail with the runtime's `ERR_PARAM_RANGE: …` (for example `setPowerPct` with `pct` above 200). `ERR_POWER_PCT_NOT_SUPPORTED` is returned only for in-range values the miner or its cooling cannot accept.
- A timeout after a physical write is an unknown result, not permission to retry.
- `setNetwork` and `updateFirmware` use single-attempt paths. Confirm the miner's new address or firmware version before any further action.
- Do not issue `reboot` to an offline miner.

## Firmware compatibility

API v2 firmware 2026xx REL2 zero-pads encrypted responses instead of using PKCS#7. The Worker detects this and decrypts both formats; no configuration is needed.

## Mock

Start the bundled API v3 mock on localhost:

```bash
npm run mock
```

The default endpoint is `127.0.0.1:14433` and the mock password is `super`. Override these only for local tests:

```bash
PORT=15433 WHATSMINER_PASSWORD='test-only-password' npm run mock
```
