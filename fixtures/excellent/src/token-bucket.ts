export interface Clock {
  now(): number;
}

export class TokenBucket {
  private available: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly clock: Clock,
  ) {
    if (capacity <= 0 || refillPerSecond <= 0) {
      throw new Error("capacity and refill rate must be positive");
    }
    this.available = capacity;
    this.lastRefill = clock.now();
  }

  take(count = 1): boolean {
    if (!Number.isInteger(count) || count <= 0 || count > this.capacity) {
      return false;
    }
    this.refill();
    if (this.available < count) return false;
    this.available -= count;
    return true;
  }

  private refill(): void {
    const now = this.clock.now();
    const elapsedSeconds = Math.max(0, now - this.lastRefill) / 1_000;
    this.available = Math.min(
      this.capacity,
      this.available + elapsedSeconds * this.refillPerSecond,
    );
    this.lastRefill = now;
  }
}
