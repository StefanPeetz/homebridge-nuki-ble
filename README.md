# homebridge-nuki-ble

Homebridge plugin for **Nuki Smart Locks** via direct Bluetooth Low Energy (BLE) — no Nuki Bridge required.

Exposes Lock/Unlock, Unlatch, Calibration and Advanced Config (incl. Detached Cylinder) directly to Apple HomeKit using the [Nuki Bluetooth API](https://developer.nuki.io/c/apis/bluetooth-api/18) and [pyNukiBT](https://github.com/ronengr/pyNukiBT).

## Architecture

```
Home app / HomeKit
      |
  Homebridge
      |
 Dynamic Platform Plugin (TypeScript)
      |
  Python subprocess (pyNukiBT)
      |
    BLE -> Nuki Smart Lock
```

## Requirements

- Homebridge >= 1.6.0 or 2.x
- Node.js >= 18
- Python >= 3.10 with `pyNukiBT` installed
- Bluetooth adapter on the Homebridge host (Raspberry Pi 3B+ or 4 recommended)

```bash
pip install pyNukiBT
```

## Installation

```bash
npm install -g homebridge-nuki-ble
```

## Pairing

1. Put the Nuki lock into pairing mode (press and hold the button until the ring flashes).
2. Run the pairing helper:

```bash
python3 $(npm root -g)/homebridge-nuki-ble/python/pair.py AA:BB:CC:DD:EE:FF
```

Credentials are saved to `~/.homebridge/nuki-ble-creds/<address>.json`.

## Configuration

```json
{
  "platforms": [
    {
      "platform": "NukiBle",
      "name": "Nuki BLE",
      "pythonBin": "python3",
      "pollIntervalSeconds": 60,
      "devices": [
        {
          "name": "Front Door",
          "address": "AA:BB:CC:DD:EE:FF",
          "enableUnlatch": true,
          "enableCalibrate": false,
          "detachedCylinder": true
        }
      ]
    }
  ]
}
```

### `detachedCylinder`

Set to `true` if you have a **priority cylinder** where the inner handle does not move synchronously with the outer key. Activates the BLE-only Advanced Config workaround on plugin startup.

## HomeKit Services per Lock

| Service | Characteristics | Notes |
|---|---|---|
| LockMechanism | LockCurrentState, LockTargetState | Main lock control |
| Battery | BatteryLevel, StatusLowBattery | |
| Switch "Unlatch" | On | Enabled by default |
| Switch "Calibrate" | On | Disabled by default |

## References

- [Nuki Bluetooth API](https://developer.nuki.io/c/apis/bluetooth-api/18)
- [pyNukiBT](https://github.com/ronengr/pyNukiBT)
- [homebridge-nubli](https://github.com/henry-spanka/homebridge-nubli)
