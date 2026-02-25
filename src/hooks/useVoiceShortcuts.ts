import { useState, useEffect, useRef, useCallback } from 'react';
import { getSpeechRecognitionService, VoiceTransactionData } from '@/lib/voice/speech-recognition';

interface UseVoiceShortcutsReturn {
  isListening: boolean;
  transcript: string;
  voiceData: VoiceTransactionData | null;
  isVoiceModeActive: boolean;
  resetVoiceState: () => void;
  manualTrigger: () => void;
  isLoading: boolean;
  error: string | null;
}

export function useVoiceShortcuts(): UseVoiceShortcutsReturn {
  const [isListening, setIsListening] = useState(false);
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceData, setVoiceData] = useState<VoiceTransactionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Get service instance lazily or inside effect to ensure window is defined
  const getService = useCallback(() => {
    try {
      return getSpeechRecognitionService();
    } catch (e) {
      console.error("Failed to get speech service:", e);
      return null;
    }
  }, []);

  const startListening = useCallback(async () => {
    const speechService = getService();
    if (!speechService) {
      setError("Voice service unavailable");
      return;
    }

    try {
      setIsListening(true);
      setError(null);
      setTranscript('');

      const result = await speechService.startListening();
      setTranscript(result);

      setIsLoading(true);
      const parsed = await speechService.parseVoiceInput(result);
      setVoiceData(parsed);
    } catch (err) {
      console.error("Voice shortcut error:", err);
      setError(err instanceof Error ? err.message : 'Voice input failed');
      // If error occurs, we might want to keep the mode active to show the error
      // or reset. For now, let's keep it active so user sees error.
    } finally {
      setIsListening(false);
      setIsLoading(false);
    }
  }, [getService]);

  const activateVoiceMode = useCallback(() => {
    setIsVoiceModeActive(true);
    startListening();
  }, [startListening]);

  const resetVoiceState = useCallback(() => {
    setIsVoiceModeActive(false);
    setIsListening(false);
    setTranscript('');
    setVoiceData(null);
    setError(null);

    // Stop listening if active
    const speechService = getService();
    if (speechService) {
      speechService.stopListening();
    }
  }, [getService]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check if user is typing in an input or textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    if ((e.key === 'v' || e.key === 'V') && !e.repeat && !isVoiceModeActive && !timerRef.current) {
      // Start 2s timer
      timerRef.current = setTimeout(() => {
        activateVoiceMode();
        timerRef.current = null;
      }, 2000);
    }
  }, [isVoiceModeActive, activateVoiceMode]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'v' || e.key === 'V') {
      if (timerRef.current) {
        // Released before 2s
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    isListening,
    transcript,
    voiceData,
    isVoiceModeActive,
    resetVoiceState,
    manualTrigger: activateVoiceMode,
    isLoading,
    error
  };
}
