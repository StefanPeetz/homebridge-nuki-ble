#!/usr/bin/env python3
"""
Nuki BLE Bridge -- thin wrapper around pyNukiBT for homebridge-nuki-ble.

Usage:
  python3 nuki_ble_bridge.py '<json-payload>'

Payload fields:
  command                  : state | lock | unlock | unlatch | calibrate
                             | set_advanced_config | pair
  device.address           : BLE MAC address of the Nuki lock
  device.credentialsFile   : (optional) path to credentials JSON
  detachedCylinder         : (optional) bool, used by set_advanced_config

Output (one JSON line to stdout):
  { "ok": true,  "result": { ... } }
  { "ok": false, "error": "message" }

Dependencies:
  pip install pyNukiBT
"""

import asyncio
import json
import os
import sys
from pathlib import Path


def _out(data: dict) -> None:
    print(json.dumps(data), flush=True)


try:
    from pynukibt.nuki import NukiManager  # type: ignore
except ImportError:
    _out({"ok": False, "error": "pyNukiBT not installed -- run: pip install pyNukiBT"})
    sys.exit(1)


def _load_credentials(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        return {}
    with p.open() as f:
        return json.load(f)


def _save_credentials(path: str, creds: dict) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(creds, f, indent=2)


async def run_command(payload: dict) -> None:
    command = payload.get("command", "")
    device  = payload.get("device", {})
    address = device.get("address", "")
    cred_file = device.get("credentialsFile") or os.path.expanduser(
        f"~/.homebridge/nuki-ble-creds/{address.replace(':', '')}.json"
    )

    if not address:
        _out({"ok": False, "error": "device.address is required"})
        return

    creds = _load_credentials(cred_file)

    manager = NukiManager(
        address=address,
        auth_id=creds.get("authId"),
        nuki_public_key=creds.get("nukiPublicKey"),
        client_private_key=creds.get("clientPrivateKey"),
        client_public_key=creds.get("clientPublicKey"),
    )

    if command == "pair":
        await manager.pair()
        new_creds = {
            "authId":           manager.auth_id,
            "nukiPublicKey":    manager.nuki_public_key,
            "clientPrivateKey": manager.private_key,
            "clientPublicKey":  manager.public_key,
        }
        _save_credentials(cred_file, new_creds)
        _out({"ok": True, "result": {"paired": True, "credentialsFile": cred_file}})
        return

    if not creds:
        _out({"ok": False, "error": f"No credentials at {cred_file}. Run the pair command first."})
        return

    await manager.connect()

    try:
        if command == "state":
            state = await manager.get_keyturner_state()
            _out({
                "ok": True,
                "result": {
                    "lockState":      state.lock_state,
                    "batteryLevel":   state.battery_level,
                    "lowBattery":     state.battery_level < 20,
                    "doorSensorState": getattr(state, "door_sensor_state", None),
                }
            })

        elif command == "lock":
            await manager.lock()
            _out({"ok": True, "result": {"command": "lock"}})

        elif command == "unlock":
            await manager.unlock()
            _out({"ok": True, "result": {"command": "unlock"}})

        elif command == "unlatch":
            await manager.unlatch()
            _out({"ok": True, "result": {"command": "unlatch"}})

        elif command == "calibrate":
            await manager.request_calibration()
            _out({"ok": True, "result": {"command": "calibrate"}})

        elif command == "set_advanced_config":
            cfg = await manager.get_advanced_config()
            detached = payload.get("detachedCylinder")
            if detached is not None:
                cfg.detached_cylinder = bool(detached)
            await manager.set_advanced_config(cfg)
            _out({"ok": True, "result": {"command": "set_advanced_config"}})

        else:
            _out({"ok": False, "error": f"Unknown command: {command}"})

    finally:
        await manager.disconnect()


def main() -> None:
    if len(sys.argv) < 2:
        _out({"ok": False, "error": "No payload argument provided"})
        sys.exit(1)
    try:
        payload = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        _out({"ok": False, "error": f"Invalid JSON payload: {e}"})
        sys.exit(1)
    try:
        asyncio.run(run_command(payload))
    except Exception as e:  # pylint: disable=broad-except
        _out({"ok": False, "error": str(e)})
        sys.exit(1)


if __name__ == "__main__":
    main()
