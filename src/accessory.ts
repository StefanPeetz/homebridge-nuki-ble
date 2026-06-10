import { PlatformAccessory, Service, CharacteristicValue } from 'homebridge';
import { NukiBlePlatform } from './platform';
import { PythonBridge } from './python-bridge';
import { ActionQueue } from './action-queue';
import { DeviceConfig, LockState } from './types';

// Nuki BLE API lock state constants
const NUKI_LOCKED    = 1;
const NUKI_UNLOCKED  = 3;
const NUKI_UNLATCHED = 5;

export class NukiAccessory {
  private readonly lockService: Service;
  private readonly batteryService: Service;
  private unlatchService?: Service;
  private calibrateService?: Service;

  private readonly bridge: PythonBridge;
  private readonly queue: ActionQueue;
  private cachedState: LockState | null = null;

  constructor(
    private readonly platform: NukiBlePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly config: DeviceConfig,
    pythonBin: string,
    private readonly pollIntervalMs: number,
  ) {
    const { Service, Characteristic } = this.platform.api.hap;

    this.bridge = new PythonBridge(this.platform.log, pythonBin, config);
    this.queue  = new ActionQueue(this.platform.log);

    // AccessoryInformation
    this.accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'Nuki')
      .setCharacteristic(Characteristic.Model, 'Smart Lock (BLE)')
      .setCharacteristic(Characteristic.SerialNumber, config.address);

    // LockMechanism
    this.lockService = this.accessory.getService(Service.LockMechanism)
      ?? this.accessory.addService(Service.LockMechanism);
    this.lockService.setCharacteristic(Characteristic.Name, config.name);

    this.lockService.getCharacteristic(Characteristic.LockCurrentState)
      .onGet(() => this.handleCurrentStateGet());

    this.lockService.getCharacteristic(Characteristic.LockTargetState)
      .onGet(() => this.handleTargetStateGet())
      .onSet((v) => this.handleTargetStateSet(v));

    // Battery
    this.batteryService = this.accessory.getService(Service.Battery)
      ?? this.accessory.addService(Service.Battery);
    this.batteryService.getCharacteristic(Characteristic.BatteryLevel)
      .onGet(() => this.batteryLevel());
    this.batteryService.getCharacteristic(Characteristic.StatusLowBattery)
      .onGet(() => this.lowBattery());

    // Optional: Unlatch switch
    if (config.enableUnlatch !== false) {
      this.unlatchService = this.accessory.getService('Unlatch')
        ?? this.accessory.addService(Service.Switch, 'Unlatch', 'unlatch');
      this.unlatchService.setCharacteristic(Characteristic.Name, 'Unlatch');
      this.unlatchService.getCharacteristic(Characteristic.On)
        .onGet(() => false)
        .onSet((v) => { if (v) this.queue.enqueue(() => this.bridge.run('unlatch')); });
    }

    // Optional: Calibrate switch
    if (config.enableCalibrate) {
      this.calibrateService = this.accessory.getService('Calibrate')
        ?? this.accessory.addService(Service.Switch, 'Calibrate', 'calibrate');
      this.calibrateService.setCharacteristic(Characteristic.Name, 'Calibrate');
      this.calibrateService.getCharacteristic(Characteristic.On)
        .onGet(() => false)
        .onSet((v) => { if (v) this.queue.enqueue(() => this.bridge.run('calibrate')); });
    }

    // Detached cylinder: push Advanced Config on startup
    if (config.detachedCylinder) {
      this.queue.enqueue(() =>
        this.bridge.run('set_advanced_config', { detachedCylinder: true }));
    }

    this.startPolling();
  }

  private async getState(): Promise<LockState> {
    const result = await this.queue.enqueue(() => this.bridge.run('state')) as LockState;
    this.cachedState = result;
    return result;
  }

  private toHkCurrentState(nukiState: number): CharacteristicValue {
    const { LockCurrentState } = this.platform.api.hap.Characteristic;
    if (nukiState === NUKI_LOCKED)    return LockCurrentState.SECURED;
    if (nukiState === NUKI_UNLOCKED)  return LockCurrentState.UNSECURED;
    if (nukiState === NUKI_UNLATCHED) return LockCurrentState.UNSECURED;
    return LockCurrentState.UNKNOWN;
  }

  private toHkTargetState(nukiState: number): CharacteristicValue {
    const { LockTargetState } = this.platform.api.hap.Characteristic;
    return nukiState === NUKI_LOCKED ? LockTargetState.SECURED : LockTargetState.UNSECURED;
  }

  private async handleCurrentStateGet(): Promise<CharacteristicValue> {
    const s = await this.getState();
    return this.toHkCurrentState(s.lockState);
  }

  private async handleTargetStateGet(): Promise<CharacteristicValue> {
    const s = this.cachedState ?? await this.getState();
    return this.toHkTargetState(s.lockState);
  }

  private async handleTargetStateSet(value: CharacteristicValue): Promise<void> {
    const { LockTargetState } = this.platform.api.hap.Characteristic;
    const cmd = value === LockTargetState.SECURED ? 'lock' : 'unlock';
    await this.queue.enqueue(() => this.bridge.run(cmd));
  }

  private async batteryLevel(): Promise<CharacteristicValue> {
    const s = this.cachedState ?? await this.getState();
    return s.batteryLevel;
  }

  private async lowBattery(): Promise<CharacteristicValue> {
    const { StatusLowBattery } = this.platform.api.hap.Characteristic;
    const s = this.cachedState ?? await this.getState();
    return s.lowBattery
      ? StatusLowBattery.BATTERY_LEVEL_LOW
      : StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  private startPolling(): void {
    const poll = async () => {
      try {
        const state = await this.getState();
        const { LockCurrentState, LockTargetState } = this.platform.api.hap.Characteristic;
        this.lockService.updateCharacteristic(LockCurrentState, this.toHkCurrentState(state.lockState));
        this.lockService.updateCharacteristic(LockTargetState,  this.toHkTargetState(state.lockState));
        this.batteryService.updateCharacteristic(
          this.platform.api.hap.Characteristic.BatteryLevel, state.batteryLevel);
      } catch (err) {
        this.platform.log.warn(`[${this.config.name}] Poll failed:`, (err as Error).message);
      }
      setTimeout(poll, this.pollIntervalMs);
    };
    setTimeout(poll, 5_000);
  }
}
