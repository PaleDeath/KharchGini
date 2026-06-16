// Mock SpeechRecognition API
class MockSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = 'en-US';
    this.maxAlternatives = 1;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.onstart = null;
    this.onaudiostart = null;
    this.onaudioend = null;
    this.onsoundstart = null;
    this.onsoundend = null;
    this.onspeechstart = null;
    this.onspeechend = null;
    this.onnomatch = null;
  }

  start() {
    // Simulate start
    if (this.onstart) this.onstart(new Event('start'));
    if (this.onaudiostart) this.onaudiostart(new Event('audiostart'));

    // Simulate speech recognition (optional: expose a method to trigger result manually)
    // For now, this mock just ensures the service can be instantiated without error.
  }

  stop() {
    if (this.onend) this.onend(new Event('end'));
  }

  abort() {
    if (this.onend) this.onend(new Event('end'));
  }
}

// Attach to window
Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: MockSpeechRecognition,
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  writable: true,
  value: MockSpeechRecognition,
});

// Mock MediaRecorder API (needed for startCloudRecognition)
class MockMediaRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.mimeType = options.mimeType || 'audio/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) this.onstop(new Event('stop'));
  }

  static isTypeSupported(type) {
    return true;
  }
}

Object.defineProperty(window, 'MediaRecorder', {
  writable: true,
  value: MockMediaRecorder,
});

// Mock navigator.mediaDevices.getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    }),
  },
});
