#!/usr/bin/env python3
"""
Standalone pairing helper for homebridge-nuki-ble.

Run once to pair a Nuki Smart Lock:
  python3 python/pair.py AA:BB:CC:DD:EE:FF [/optional/path/to/creds.json]

The lock must be in pairing mode (hold button until ring flashes).
Created credentials are saved to ~/.homebridge/nuki-ble-creds/<address>.json
or the provided path.

Dependencies:
  pip install pyNukiBT
"""

import asyncio
import json
import os
import sys
from pathlib import Path

try:
    from pynukibt.nuki import NukiManager  # type: ignore
except ImportError:
    print("pyNukiBT not installed. Run: pip install pyNukiBT")
    sys.exit(1)


async def pair(address: str, cred_file: str) -> None:
    print(f"Pairing with {address} ...")
    print("Make sure the lock is in pairing mode (press and hold the button).")

    manager = NukiManager(address=address)
    await manager.pair()

    creds = {
        "authId":           manager.auth_id,
        "nukiPublicKey":    manager.nuki_public_key,
        "clientPrivateKey": manager.private_key,
        "clientPublicKey":  manager.public_key,
    }
    Path(cred_file).parent.mkdir(parents=True, exist_ok=True)
    with open(cred_file, "w") as f:
        json.dump(creds, f, indent=2)

    print(f"Pairing successful. Credentials saved to: {cred_file}")
    print(json.dumps(creds, indent=2))


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: pair.py <BLE-MAC-address> [credentials-file]")
        sys.exit(1)

    address   = sys.argv[1]
    cred_file = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser(
        f"~/.homebridge/nuki-ble-creds/{address.replace(':', '')}.json"
    )

    asyncio.run(pair(address, cred_file))


if __name__ == "__main__":
    main()
