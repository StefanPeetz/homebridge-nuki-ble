import { Logger } from 'homebridge';

type Task<T> = () => Promise<T>;

/**
 * Serial action queue — ensures only one BLE command runs at a time per lock.
 * Prevents parallel BLE connections colliding on the same device.
 */
export class ActionQueue {
  private queue: Array<() => void> = [];
  private running = false;

  constructor(private readonly log: Logger) {}

  enqueue<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task());
        } catch (err) {
          reject(err);
        }
      });
      this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await task();
      } catch (err) {
        this.log.error('ActionQueue task error:', (err as Error).message);
      }
    }
    this.running = false;
  }
}
