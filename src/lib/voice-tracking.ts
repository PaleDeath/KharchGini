export interface VoiceStats {
  voiceCommandsUsed: number;
  successfulParses: number;
  averageProcessingTime: number; // in milliseconds
}

const STORAGE_KEY = 'voice_usage_stats';

const DEFAULT_STATS: VoiceStats = {
  voiceCommandsUsed: 0,
  successfulParses: 0,
  averageProcessingTime: 0,
};

export function getVoiceStats(): VoiceStats {
  if (typeof window === 'undefined') {
    return DEFAULT_STATS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_STATS;
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error reading voice stats:', error);
    return DEFAULT_STATS;
  }
}

function saveVoiceStats(stats: VoiceStats) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Error saving voice stats:', error);
  }
}

export function trackVoiceCommandAttempt() {
  const stats = getVoiceStats();
  const newStats = {
    ...stats,
    voiceCommandsUsed: stats.voiceCommandsUsed + 1,
  };
  saveVoiceStats(newStats);
  return newStats;
}

export function trackVoiceCommandSuccess(processingTimeMs: number) {
  const stats = getVoiceStats();

  // Calculate new average
  // Formula: ((old_avg * old_count) + new_val) / (old_count + 1)
  const currentTotalTime = stats.averageProcessingTime * stats.successfulParses;
  const newTotalTime = currentTotalTime + processingTimeMs;
  const newCount = stats.successfulParses + 1;
  const newAverage = newTotalTime / newCount;

  const newStats = {
    ...stats,
    successfulParses: newCount,
    averageProcessingTime: newAverage,
  };

  saveVoiceStats(newStats);
  return newStats;
}
