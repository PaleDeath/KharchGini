import { useState, useEffect, useRef, useCallback } from 'react';

// Use local interfaces to avoid conflicts with global types or other declarations
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface ISpeechRecognitionEvent {
  results: ISpeechRecognitionResultList;
  resultIndex: number;
}

interface ISpeechRecognitionResultList {
  length: number;
  item(index: number): ISpeechRecognitionResult;
  [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): ISpeechRecognitionAlternative;
  [index: number]: ISpeechRecognitionAlternative;
}

interface ISpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export interface UseSpeechRecognitionReturn {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
  supported: boolean;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.SpeechRecognition || win.webkitSpeechRecognition) {
        setSupported(true);
      }
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }, 5000); // 5 seconds silence timeout
  }, []);

  const startListening = useCallback(() => {
    if (!supported) return;

    // Clean up any existing recognition instance
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Reset state
    setTranscript('');
    setError(null);

    const win = window as any;
    const SpeechRecognitionConstructor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setError('Speech recognition not supported.');
      return;
    }

    const recognition: ISpeechRecognition = new SpeechRecognitionConstructor();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        fullTranscript += event.results[i][0].transcript;
      }
      setTranscript(fullTranscript);
      resetSilenceTimer();
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        setError('No speech detected.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone permission denied.');
      } else if (event.error === 'network') {
        setError('Network error occurred.');
      } else {
        setError(event.error);
      }
      // Usually stop on error, but let onend handle the isListening state
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    try {
      recognition.start();
      setIsListening(true);
      resetSilenceTimer();
    } catch (err) {
      console.error('Speech recognition start failed:', err);
      setError('Failed to start speech recognition.');
    }
  }, [supported, resetSilenceTimer]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    error,
    supported,
  };
}
