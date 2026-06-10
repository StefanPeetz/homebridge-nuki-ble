export interface DeviceConfig {
  name: string;
  address: string;
  credentialsFile?: string;
  enableUnlatch?: boolean;
  enableCalibrate?: boolean;
  detachedCylinder?: boolean;
}

export interface LockState {
  /** 1=locked, 3=unlocked, 5=unlatched, 255=undefined */
  lockState: number;
  /** 0-100 */
  batteryLevel: number;
  lowBattery: boolean;
  doorSensorState?: number;
}

export interface BridgeResponse {
  ok: boolean;
  result?: LockState | Record<string, unknown>;
  error?: string;
}
