import confetti from 'canvas-confetti';
import { haversineDistanceMiles } from '../services/router';

/**
 * Route Simulator for Grocery Delivery
 * Animates the delivery van along real Overland Park street coordinates.
 */
export class RouteSimulator {
  constructor(mapManager, options = {}) {
    this.map = mapManager;
    this.onProgressUpdate = options.onProgressUpdate || null;
    this.onStopDelivered = options.onStopDelivered || null;
    this.onComplete = options.onComplete || null;

    this.coordinates = []; // [[lng, lat], ...]
    this.stops = [];
    this.store = null;

    this.isRunning = false;
    this.isPaused = false;
    this.speedMultiplier = 2; // Default 2x
    this.currentIndex = 0;
    this.animationFrameId = null;
    this.isDeliveringAtStop = false;
    this.deliveredStopIds = new Set();
  }

  setRoute(coordinates, stops, store) {
    this.stop();
    this.coordinates = coordinates || [];
    this.stops = stops || [];
    this.store = store || null;
    this.currentIndex = 0;
    this.deliveredStopIds.clear();

    if (this.coordinates.length > 0) {
      const first = this.coordinates[0];
      this.map.renderTruckMarker(first[1], first[0], 0, 'Depot: Ready for departure');
    }
  }

  start() {
    if (this.coordinates.length < 2) return;
    if (this.isPaused) {
      this.isPaused = false;
      this.isRunning = true;
      this.loop();
      return;
    }

    this.stop();
    this.isRunning = true;
    this.isPaused = false;
    this.currentIndex = 0;
    this.deliveredStopIds.clear();

    // Reset markers to pending
    this.stops.forEach(s => {
      this.map.updateStopStatus(s.id, 'pending');
    });

    this.loop();
  }

  pause() {
    this.isPaused = true;
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.isDeliveringAtStop = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.coordinates.length > 0) {
      const first = this.coordinates[0];
      this.map.renderTruckMarker(first[1], first[0], 0, 'Depot: Stopped');
    }
  }

  setSpeed(multiplier) {
    this.speedMultiplier = Math.max(0.5, multiplier);
  }

  seek(fraction) {
    if (this.coordinates.length < 2) return;
    const targetIdx = Math.floor(fraction * (this.coordinates.length - 1));
    this.currentIndex = Math.max(0, Math.min(targetIdx, this.coordinates.length - 1));
    const coord = this.coordinates[this.currentIndex];
    this.map.renderTruckMarker(coord[1], coord[0], 0, 'Delivery Van');
  }

  loop() {
    if (!this.isRunning || this.isPaused) return;

    if (this.isDeliveringAtStop) {
      return; // Waiting for stop drop-off animation
    }

    // Advance based on speed
    const stepIncrement = Math.max(1, Math.round(this.speedMultiplier));
    this.currentIndex += stepIncrement;

    if (this.currentIndex >= this.coordinates.length - 1) {
      this.currentIndex = this.coordinates.length - 1;
      this.handleFinish();
      return;
    }

    const currentCoord = this.coordinates[this.currentIndex];
    const prevCoord = this.coordinates[Math.max(0, this.currentIndex - 1)];

    const curLat = currentCoord[1];
    const curLng = currentCoord[0];
    const prevLat = prevCoord[1];
    const prevLng = prevCoord[0];

    const heading = this.calculateBearing(prevLat, prevLng, curLat, curLng);

    // Check proximity to undelivered stops
    const nearbyStop = this.findNearbyUndeliveredStop(curLat, curLng);

    if (nearbyStop) {
      this.isDeliveringAtStop = true;
      this.deliveredStopIds.add(nearbyStop.id);
      this.map.updateStopStatus(nearbyStop.id, 'delivered');

      if (this.onStopDelivered) {
        this.onStopDelivered(nearbyStop);
      }

      const tooltipMsg = `Delivered to ${nearbyStop.customerName}! (${nearbyStop.bags} bags)`;
      this.map.renderTruckMarker(curLat, curLng, heading, tooltipMsg);

      // Brief drop-off pause (1000ms / speed)
      const pauseDuration = Math.max(300, 1200 / this.speedMultiplier);
      setTimeout(() => {
        this.isDeliveringAtStop = false;
        if (this.isRunning && !this.isPaused) {
          this.loop();
        }
      }, pauseDuration);

      return;
    }

    // Determine current destination stop info
    const nextStop = this.stops.find(s => !this.deliveredStopIds.has(s.id));
    const statusText = nextStop
      ? `En route to Stop #${nextStop.sequence}: ${nextStop.customerName}`
      : 'Returning to Overland Park Depot';

    this.map.renderTruckMarker(curLat, curLng, heading, statusText);

    // Notify progress
    const progress = (this.currentIndex / (this.coordinates.length - 1));
    if (this.onProgressUpdate) {
      this.onProgressUpdate(progress, this.currentIndex, this.coordinates.length);
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }

  findNearbyUndeliveredStop(lat, lng) {
    const thresholdMiles = 0.08; // ~400 feet proximity
    for (const stop of this.stops) {
      if (this.deliveredStopIds.has(stop.id)) continue;
      const dist = haversineDistanceMiles(lat, lng, stop.lat, stop.lng);
      if (dist <= thresholdMiles) {
        return stop;
      }
    }
    return null;
  }

  handleFinish() {
    this.isRunning = false;
    this.isPaused = false;
    const finalCoord = this.coordinates[this.coordinates.length - 1];
    this.map.renderTruckMarker(finalCoord[1], finalCoord[0], 0, 'Run Finished! All Deliveries Done ✓');

    // Mark any remaining stops as delivered
    this.stops.forEach(s => {
      this.map.updateStopStatus(s.id, 'delivered');
    });

    // Launch Confetti Celebration
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#f59e0b', '#3b82f6']
    });

    if (this.onComplete) {
      this.onComplete();
    }
  }

  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const y = Math.sin(dLon) * Math.cos(lat2 * (Math.PI / 180));
    const x =
      Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
      Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos(dLon);
    const brng = Math.atan2(y, x) * (180 / Math.PI);
    return (brng + 360) % 360;
  }
}
