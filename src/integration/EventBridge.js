import { BRIDGE_EVENTS } from '../utils/constants';

class EventBridge {
  emit(eventName, payload = {}) {
    const message = {
      source: 'phaser-troll-platformer',
      event: eventName,
      payload,
      timestamp: Date.now(),
    };

    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`game:${eventName}`, { detail: message }));
    }
  }

  emitLevelStarted(payload) {
    this.emit(BRIDGE_EVENTS.LEVEL_STARTED, payload);
  }

  emitLevelFailed(payload) {
    this.emit(BRIDGE_EVENTS.LEVEL_FAILED, payload);
  }

  emitLevelCompleted(payload) {
    this.emit(BRIDGE_EVENTS.LEVEL_COMPLETED, payload);
  }

  emitGameCompleted(payload) {
    this.emit(BRIDGE_EVENTS.GAME_COMPLETED, payload);
  }
}

export const eventBridge = new EventBridge();
