import { Logger } from 'homebridge';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { BridgeResponse, DeviceConfig } from './types';

export class PythonBridge {
  private readonly scriptPath: string;

  constructor(
    private readonly log: Logger,
    private readonly pythonBin: string,
    private readonly device: DeviceConfig,
  ) {
    this.scriptPath = path.join(__dirname, '..', 'python', 'nuki_ble_bridge.py');
  }

  async run(command: string, extra: Record<string, unknown> = {}): Promise<unknown> {
    const payload = JSON.stringify({ command, device: this.device, ...extra });

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(this.pythonBin, [this.scriptPath, payload], { timeout: 30_000 });

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        if (stderr) this.log.debug(`[bridge stderr] ${stderr.trim()}`);
        if (code !== 0) {
          reject(new Error(`Python bridge exited ${code}: ${stderr.trim() || stdout.trim()}`));
          return;
        }
        try {
          const parsed: BridgeResponse = JSON.parse(stdout.trim());
          if (!parsed.ok) {
            reject(new Error(parsed.error ?? 'bridge returned ok=false'));
          } else {
            resolve(parsed.result);
          }
        } catch {
          reject(new Error(`Failed to parse bridge output: ${stdout.trim()}`));
        }
      });

      proc.on('error', reject);
    });
  }
}
