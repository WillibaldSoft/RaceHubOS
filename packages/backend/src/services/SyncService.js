import { randomUUID } from 'node:crypto';
import { SectorTiming } from '../lib/sectorTiming.js';

/**
 * SyncService - Synchronisation hardware CU/Simulator
 *
 * Responsabilite unique : formater les donnees hardware et les transmettre
 * - Ecoute CU/Simulator events
 * - Formate les donnees (calcul lapTime depuis timestamps)
 * - Emet cu:* events pour le frontend (logs/footer)
 * - Appelle SessionService pour la logique session
 */
export class SyncService {
  constructor(io) {
    this.source = null; // ControlUnit ou Simulator (set via setDevice)
    this.io = io;
    this.sessionService = null;

    // Timestamps pour calcul lapTime
    this.sectors = new SectorTiming();
    this.sectorSessionKey = null;
    this.lastTimestamps = new Map(); // controller -> timestamp

    // CU status & polling
    this.cuStatus = null;
    this.pollInterval = 500;
    this.pollTimer = null;
    this._polling = false;
    this._pollGeneration = 0;
    this._pollInFlight = null;
    this.lastStatusAt = null;
    this.serverId = randomUUID();
    this.revision = 0;
    this._lastStatusSignature = null;
    this._lastStatusBroadcastAt = 0;

    // Bound handlers for cleanup
    this._timerProcessing = Promise.resolve();
    this._onTimer = (event) => {
      this._timerProcessing = this._timerProcessing
        .then(() => this.handleTimerEvent(event))
        .catch((error) => console.warn('[SyncService] Timer processing failed:', error.message));
    };
    this._onStatus = (status) => this.handleStatus(status);
    this._onConnected = () => {
      this.publishDevice();
      this.io?.emit('cu:connected');
    };
    this._onDisconnected = () => {
      this.cuStatus = null;
      this.lastStatusAt = null;
      this.sectors.reset();
      this.lastTimestamps.clear();
      this.sectorSessionKey = null;
      this.publishDevice();
      this.io?.emit('cu:disconnected');
    };
  }

  setSessionService(sessionService) {
    this.sessionService = sessionService;
  }

  // ==================== Device Management ====================

  /**
   * Set active device (hot-swap support)
   * @param {ControlUnit|CarreraSimulator} device
   */
  setDevice(device) {
    // Remove listeners from old device
    if (this.source) {
      this.stopPolling();
      this.source.off('timer', this._onTimer);
      this.source.off('status', this._onStatus);
      this.source.off('connected', this._onConnected);
      this.source.off('disconnected', this._onDisconnected);
    }

    // Clear state
    this.lastTimestamps.clear();
    this.sectors.reset();
    this.sectorSessionKey = null;
    this.cuStatus = null;
    this.lastStatusAt = null;
    this._lastStatusSignature = null;
    this._lastStatusBroadcastAt = 0;

    // Set new device
    this.source = device;

    if (device) {
      this.setupListeners();
    }
    this.publishDevice();
  }

  /**
   * Get current device
   */
  getDevice() {
    return this.source;
  }

  // ==================== Event Listeners ====================

  setupListeners() {
    if (!this.source) return;

    this.source.on('timer', this._onTimer);
    this.source.on('status', this._onStatus);
    this.source.on('connected', this._onConnected);
    this.source.on('disconnected', this._onDisconnected);
  }

  // ==================== Hardware Event Handlers ====================

  /**
   * Handle timer event from CU/Simulator
   * Format: { controller: 0-5, timestamp: ms, sector: 1-3 }
   */
  async handleTimerEvent(event) {
    const { controller, timestamp, sector } = event;
    if (
      !Number.isInteger(controller) ||
      controller < 0 ||
      controller > 5 ||
      !Number.isFinite(timestamp) ||
      timestamp <= 0 ||
      ![1, 2, 3].includes(sector)
    )
      return;
    const session = this.sessionService;
    const running = session?.isActive() && session.sessionStatus !== 'paused';
    const key = running ? `${session.activeSessionId}:${session.currentPhase}` : null;
    if (key !== this.sectorSessionKey) {
      this.sectors.reset();
      this.lastTimestamps.clear();
      this.sectorSessionKey = key;
    }
    const isFinishLine = sector === 1;

    let lapTime = 0;
    if (isFinishLine && timestamp > 0) {
      const lastTimestamp = this.lastTimestamps.get(controller) || 0;
      lapTime = lastTimestamp > 0 ? timestamp - lastTimestamp : 0;
      if (lapTime >= 0) {
        this.lastTimestamps.set(controller, timestamp);
      } else {
        lapTime = 0; // Restart all controller baselines after a CU clock reset.
        this.lastTimestamps.clear();
        this.lastTimestamps.set(controller, timestamp);
        this.sectors.reset();
      }
    }

    // Emit raw timer (for frontend logs/footer)
    this.io?.emit('cu:timer', { controller, timestamp, lapTime, sector, isFinishLine });

    const sectors = key ? this.sectors.push(event) : null;
    if (sectors && !isFinishLine) session.handleSector?.(controller, sectors);
    if (isFinishLine && running) {
      await session.handleLap({ controller, timestamp, lapTime, sector, sectors });
    }
  }

  /**
   * Handle status event from CU
   */
  handleStatus(status) {
    const wasInLights = this.isInLightsSequence(this.cuStatus);
    const isInLights = this.isInLightsSequence(status);
    const isNowRacing = status?.start === 0 || status?.start === 7;
    const wasNotRacing = this.cuStatus?.start >= 1 && this.cuStatus?.start <= 6;

    const wasNotInLights = !wasInLights;
    const isFirstLight = status?.start === 1;

    this.cuStatus = status;
    this.lastStatusAt = Date.now();
    this.revision++;
    const snapshot = this.getDeviceSnapshot();
    const signature = JSON.stringify(status);
    if (signature !== this._lastStatusSignature || this.lastStatusAt - this._lastStatusBroadcastAt >= 2000) {
      this._lastStatusSignature = signature;
      this._lastStatusBroadcastAt = this.lastStatusAt;
      this.io?.emit('cu:status', { ...status, ...snapshot, lastStatus: undefined });
    }

    // Clear software timing only. Hardware writes during physical START delay polling.
    if (isFirstLight && wasNotInLights) {
      this.lastTimestamps.clear();
      this.resetSectorTiming();
      this.io?.emit('cu:reset');
    }

    // Detect transition to racing (GO!) - start the timer
    if (isNowRacing && wasNotRacing && wasInLights) {
      this.sessionService?.onRaceStart();
    }

    // Adaptive polling: faster during lights sequence
    if (isInLights && !wasInLights) {
      this.setPollInterval(100);
    } else if (!isInLights && wasInLights) {
      this.setPollInterval(500);
    }
  }

  isInLightsSequence(status) {
    if (!status) return false;
    return status.start >= 1 && status.start <= 7;
  }

  // ==================== Polling ====================

  setPollInterval(ms) {
    // The active loop reads this value after the current request; never start a
    // second loop from inside the status handler of an in-flight request.
    this.pollInterval = ms;
  }

  startPolling() {
    if (this._polling || !this.source) return;
    this._polling = true;
    const generation = ++this._pollGeneration;
    const source = this.source;
    const valid = () => this._polling && generation === this._pollGeneration && source === this.source;
    const poll = async () => {
      this.pollTimer = null;
      if (!valid()) return;
      let result;
      try {
        // A previous generation may still be waiting for a BLE response.
        if (this._pollInFlight) await this._pollInFlight.catch(() => {});
        if (!valid()) return;
        if (source.poll && source.isConnected?.()) {
          const request = Promise.resolve().then(async () => {
            const reply = await source.poll();
            if (reply?.type === 'timer') await this._timerProcessing;
            return reply;
          });
          this._pollInFlight = request;
          try {
            result = await request;
          } finally {
            if (this._pollInFlight === request) this._pollInFlight = null;
          }
        }
      } catch (error) {
        console.warn('[SyncService] Poll error:', error.message);
      }
      // Drain pending lap events promptly, then return to the normal status rate.
      if (valid()) this.pollTimer = setTimeout(poll, result?.type === 'timer' ? 0 : this.pollInterval);
    };
    void poll();
  }

  stopPolling() {
    this._polling = false;
    this._pollGeneration++;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  // ==================== CU Control ====================

  /**
   * Prepare race - puts CU in L1 state and waits
   */
  async prepareRace() {
    if (!this.source) return;
    if (!this.source.start) return;

    // Stop polling and wait for any in-flight poll to settle
    this.stopPolling();
    if (this._pollInFlight) await this._pollInFlight.catch(() => {});

    // Send START — CU will respond with 'T' ack
    await this.source.start();
    // START acknowledgement has arrived; read the next live status immediately.

    // Resume polling — next poll should see L1
    this.startPolling();
  }

  /**
   * Start race - triggers START button (advances lights or starts countdown)
   */
  async startRace() {
    if (!this.source) return;
    if (this.source.start) {
      await this.source.start();
    }
  }

  async stopRace() {
    if (!this.source) return;
    if (this.source.stopCars) {
      await this.source.stopCars();
    }
    if (this.source.pressEsc) {
      await this.source.pressEsc();
    } else if (this.source.stop) {
      await this.source.stop();
    }
  }

  async pressButton(button) {
    if (this.source?.pressButton) {
      await this.source.pressButton(button);
    }
  }

  resetSectorTiming() {
    this.lastTimestamps.clear();
    this.sectors.reset();
    this.sectorSessionKey = null;
  }

  async reset() {
    this.lastTimestamps.clear();
    this.sectors.reset();
    this.sectorSessionKey = null;
    this.io?.emit('cu:reset');
    if (this.source?.reset) {
      await this.source.reset();
    }
    if (this.source?.clearPosition) {
      await this.source.clearPosition();
    }
  }

  // ==================== Getters ====================

  getDeviceSnapshot() {
    const connected = this.isConnected();
    const simulator = this.source?.isSimulator === true;
    return {
      available: true,
      connected,
      deviceType: this.source ? (simulator ? 'simulator' : 'controlUnit') : null,
      deviceAddress: this.source ? (simulator ? 'SIMULATOR' : this.source.address || null) : null,
      lastStatus: connected ? this.cuStatus : null,
      lastStatusAt: connected ? this.lastStatusAt : null,
      serverTime: Date.now(),
      serverId: this.serverId,
      revision: this.revision,
      pollInterval: this.pollInterval,
    };
  }

  publishDevice() {
    this.revision++;
    this.io?.emit('cu:device', this.getDeviceSnapshot());
  }

  getCuStatus() {
    return this.cuStatus;
  }

  isConnected() {
    return this.source?.isConnected?.() || false;
  }

  getInfo() {
    return (
      this.source?.getInfo?.() || {
        version: 'NOT CONNECTED',
        fuelMode: false,
        realMode: false,
        pitLane: false,
        lapCounter: false,
        numCars: 0,
      }
    );
  }

  getState() {
    return {
      connected: this.isConnected(),
      cuStatus: this.cuStatus,
      pollInterval: this.pollInterval,
    };
  }

  close() {
    this.stopPolling();
  }
}

export default SyncService;
