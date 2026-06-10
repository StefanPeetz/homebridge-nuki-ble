import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { NukiAccessory } from './accessory';
import { DeviceConfig } from './types';

export class NukiBlePlatform implements DynamicPlatformPlugin {
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('NukiBlePlatform initialising');
    this.api.on('didFinishLaunching', () => this.discoverDevices());
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.debug('Restoring cached accessory:', accessory.displayName);
    this.accessories.push(accessory);
  }

  private discoverDevices(): void {
    const devices = (this.config['devices'] ?? []) as DeviceConfig[];
    const pythonBin = (this.config['pythonBin'] as string | undefined) ?? 'python3';
    const pollInterval = ((this.config['pollIntervalSeconds'] as number | undefined) ?? 60) * 1000;

    for (const device of devices) {
      const uuid = this.api.hap.uuid.generate(device.address);
      let accessory = this.accessories.find(a => a.UUID === uuid);

      if (!accessory) {
        this.log.info('Adding new accessory:', device.name);
        accessory = new this.api.platformAccessory(device.name, uuid);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      } else {
        this.log.info('Restoring existing accessory:', device.name);
      }

      new NukiAccessory(this, accessory, device, pythonBin, pollInterval);
    }
  }
}
