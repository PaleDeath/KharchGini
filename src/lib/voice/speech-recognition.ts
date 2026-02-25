'use client';

export interface VoiceTransactionData {
  amount?: number;
  description?: string;
  type?: 'income' | 'expense';
  category?: string;
  confidence: number;
}

export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private isSupported: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined') {
      this.initializeSpeechRecognition();
    }
  }

  private initializeSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.isSupported = true;

      // Configure recognition settings for better reliability
      if (this.recognition) {
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US'; // Use US English for better compatibility
        this.recognition.maxAlternatives = 1; // Reduce alternatives for faster processing
      }
    }
  }

  public isVoiceSupported(): boolean {
    return this.isSupported;
  }

  public async startListening(): Promise<string> {
    if (!this.isSupported) {
      throw new Error('Voice recognition is currently unavailable. Please use the "Type Instead" option below to enter your transaction manually.');
    }

    try {
      // In production environments, prioritize cloud recognition over browser recognition
      // due to network issues with Web Speech API on hosted platforms
      const isProduction = typeof window !== 'undefined' && 
        (window.location.protocol === 'https:' && !window.location.hostname.includes('localhost'));
      
      if (isProduction) {
        try {
          // Try cloud recognition first in production
          console.log('Attempting cloud recognition in production environment...');
          return await this.startCloudRecognition();
        } catch (cloudError) {
          console.log('Cloud recognition failed, trying browser recognition...', cloudError);
          try {
            return await this.startBrowserRecognition();
          } catch (browserError) {
            console.error('Both cloud and browser recognition failed:', browserError);
            throw new Error('Voice recognition is currently unavailable due to network issues. Please use the "Type Instead" option below to enter your transaction manually.');
          }
        }
      } else {
        // In development, try browser first, then cloud
        try {
          return await this.startBrowserRecognition();
        } catch (browserError) {
          console.log('Browser recognition failed, trying cloud recognition...', browserError);
          try {
            return await this.startCloudRecognition();
          } catch (cloudError) {
            console.error('Both browser and cloud recognition failed:', cloudError);
            throw new Error('Voice recognition is currently unavailable. Please use the "Type Instead" option below to enter your transaction manually.');
          }
        }
      }
    } catch (error) {
      console.error('Speech recognition error:', error);
      throw new Error('Voice recognition is currently unavailable. Please use the "Type Instead" option below to enter your transaction manually.');
    }
  }

  private async startCloudRecognition(): Promise<string> {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      throw new Error('Media devices not supported in server environment');
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Media devices not supported');
    }

    return new Promise(async (resolve, reject) => {
      let selectedMimeType = 'audio/webm;codecs=opus'; // Declare in outer scope

      try {
        console.log('🎤 Starting cloud recognition...');
        
        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 48000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        console.log('🎤 Microphone access granted');
        
        // Check for supported formats in order of preference for Google Cloud
        const supportedFormats = [
          'audio/wav', // Most compatible with Speech-to-Text
          'audio/flac', // Best quality for speech recognition
          'audio/webm;codecs=opus',
          'audio/mp4',
          'audio/ogg;codecs=opus'
        ];
        
        console.log('🔧 Checking audio format support...');
        
        for (const format of supportedFormats) {
          if (MediaRecorder.isTypeSupported(format)) {
            selectedMimeType = format;
            console.log(`🔧 Selected audio format: ${format}`);
            break;
          }
        }
        
        console.log(`🔧 Final selected format: ${selectedMimeType}`);
        
        // Create MediaRecorder with the best supported format
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          audioBitsPerSecond: 128000 // Lower bitrate for better compatibility
        });
        
        console.log('🔧 MediaRecorder created with mimeType:', selectedMimeType);
        
        this.audioChunks = [];
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
            console.log(`🔧 Audio chunk received, size: ${event.data.size} total chunks: ${this.audioChunks.length}`);
          }
        };

        this.mediaRecorder.onstop = async () => {
          console.log('🔧 MediaRecorder stopped, processing audio...');
          stream.getTracks().forEach(track => track.stop());

          if (this.audioChunks.length === 0) {
            reject(new Error('No audio data recorded. Please try speaking again.'));
            return;
          }

          try {
            // Use the same MIME type that was used for recording
            const recordedMimeType = this.mediaRecorder?.mimeType || selectedMimeType || 'audio/webm;codecs=opus';
            console.log('🔧 Creating audio blob with type:', recordedMimeType);

            const audioBlob = new Blob(this.audioChunks, { type: recordedMimeType });
            console.log('🔧 Audio blob created, size:', audioBlob.size, 'bytes');

            if (audioBlob.size < 1000) {
              reject(new Error('Audio recording too short. Please speak for a longer duration or use "Type Instead".'));
              return;
            }

            const audioBase64 = await this.blobToBase64(audioBlob);
            console.log('🔧 Audio converted to base64, length:', audioBase64.length);
            console.log('🚀 Sending to cloud API with format:', recordedMimeType, 'size:', audioBlob.size);

            // Send to cloud API with audio format information
            const response = await fetch('/api/speech-to-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioData: audioBase64,
                audioFormat: recordedMimeType,
                audioSize: audioBlob.size
              })
            });

            console.log('🌐 API response status:', response.status);
            
            if (!response.ok) {
              throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('🌐 API response:', result);

            if (result.success && result.transcript) {
              console.log('✅ Cloud recognition successful:', result.transcript);
              resolve(result.transcript);
            } else if (result.fallback) {
              // If it's a fallback error (like no speech detected), provide helpful message
              const errorMsg = result.error || 'No speech detected in the audio. Please speak clearly and try again.';
              console.log('⚠️ Cloud recognition fallback:', errorMsg);
              throw new Error(errorMsg + ' Please use "Type Instead" if voice input continues to fail.');
            } else {
              const errorMsg = result.error || 'Cloud recognition failed';
              console.error('❌ Cloud recognition error:', errorMsg);
              throw new Error(errorMsg + ' Please use "Type Instead" to enter your transaction manually.');
            }
          } catch (error) {
            console.error('❌ Cloud recognition processing error:', error);
            if (error instanceof Error) {
              reject(error);
            } else {
              reject(new Error('Cloud recognition failed due to network or processing error. Please use "Type Instead".'));
            }
          }
        };

        this.mediaRecorder.onerror = (event) => {
          console.error('🔧 MediaRecorder error:', event.error);
          reject(new Error('Audio recording failed. Please try again or use "Type Instead".'));
        };

        // Start recording
        console.log('🔴 Starting audio recording...');
        this.mediaRecorder.start(1000); // Collect data every second

        // Auto-stop after 10 seconds
        setTimeout(() => {
          if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            console.log('⏰ Auto-stopping recording after 10 seconds');
            this.mediaRecorder.stop();
          }
        }, 10000);

      } catch (error) {
        console.error('❌ Cloud recognition setup error:', error);
        if (error instanceof Error && error.name === 'NotAllowedError') {
          reject(new Error('🎤 Microphone access denied. Please allow microphone permissions or use "Type Instead".'));
        } else if (error instanceof Error && error.name === 'NotFoundError') {
          reject(new Error('🎤 No microphone found. Please connect a microphone or use "Type Instead".'));
        } else {
          reject(new Error('Cloud voice recognition setup failed. Please use "Type Instead" to enter your transaction manually.'));
        }
      }
    });
  }

  private async startBrowserRecognition(): Promise<string> {
    if (!this.recognition) {
      throw new Error('Speech recognition not supported');
    }

    return new Promise((resolve, reject) => {
      if (!this.recognition) return reject(new Error('Recognition not available'));

      let hasResult = false;
      let timeoutId: NodeJS.Timeout;

      // Set a timeout to prevent hanging
      timeoutId = setTimeout(() => {
        if (this.recognition) {
          this.recognition.abort();
        }
        reject(new Error('Voice recognition timed out after 8 seconds. Please use the "Type Instead" option below.'));
      }, 8000); // 8 second timeout for browser recognition

      this.recognition.onresult = (event) => {
        hasResult = true;
        clearTimeout(timeoutId);
        
        console.log('🎤 Browser speech recognition result:', event.results);
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        
        console.log(`🎤 Transcript: "${transcript}" (confidence: ${confidence})`);
        resolve(transcript);
      };

      this.recognition.onerror = (event) => {
        clearTimeout(timeoutId);
        console.error('🎤 Speech recognition error:', event.error, event.message);

        // Provide specific error messages based on error type
        let errorMessage = 'Voice recognition is not available. Please use the "Type Instead" option below.';

        if (event.error === 'network') {
          // Network errors are very common in production environments
          errorMessage = '🌐 Voice recognition network error - this is common on deployed websites. Please use "Type Instead" to enter your transaction manually.';
        } else if (event.error === 'not-allowed') {
          errorMessage = '🎤 Microphone access denied. Please allow microphone permissions in your browser or use "Type Instead".';
        } else if (event.error === 'no-speech') {
          errorMessage = '🤐 No speech detected. Please try speaking louder and clearer, or use "Type Instead".';
        } else if (event.error === 'service-not-allowed') {
          errorMessage = '🚫 Voice recognition service blocked by browser. Please use "Type Instead" to enter your transaction manually.';
        } else if (event.error === 'bad-grammar' || event.error === 'language-not-supported') {
          errorMessage = '🌍 Voice recognition language not supported. Please use "Type Instead" to enter your transaction manually.';
        } else if (event.error === 'audio-capture') {
          errorMessage = '🎤 Microphone error. Please check your microphone connection or use "Type Instead".';
        } else if (event.error === 'aborted') {
          errorMessage = '⏹️ Voice recognition was stopped. Please try again or use "Type Instead".';
        }

        reject(new Error(errorMessage));
      };

      this.recognition.onend = () => {
        clearTimeout(timeoutId);
        console.log('🎤 Browser speech recognition ended, hasResult:', hasResult);
        if (!hasResult) {
          reject(new Error('No speech detected. Please try speaking again or use the "Type Instead" option below.'));
        }
      };

      this.recognition.onstart = () => {
        console.log('🎤 Browser speech recognition started');
      };

      this.recognition.onaudiostart = () => {
        console.log('🎤 Audio capture started');
      };

      this.recognition.onaudioend = () => {
        console.log('🎤 Audio capture ended');
      };

      try {
        console.log('🎤 Starting browser speech recognition...');
        this.recognition.start();
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('🎤 Failed to start browser speech recognition:', error);
        reject(new Error('Voice recognition failed to start. Please use the "Type Instead" option below.'));
      }
    });
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  public stopListening() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  private convertWordsToNumbers(transcript: string): string {
    const numbers: { [key: string]: number } = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
      'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
      'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90
    };

    let processed = transcript.toLowerCase();

    Object.entries(numbers).forEach(([word, num]) => {
       const regex = new RegExp(`\\b${word}\\b`, 'g');
       processed = processed.replace(regex, num.toString());
    });

    return processed;
  }

  // Parse voice input using regex patterns and AI
  public async parseVoiceInput(transcript: string): Promise<VoiceTransactionData> {
    const cleanTranscript = this.convertWordsToNumbers(transcript.toLowerCase().trim());
    
    // Extract amount using regex patterns
    const amount = this.extractAmount(cleanTranscript);
    
    // Extract transaction type
    const type = this.extractTransactionType(cleanTranscript);
    
    // Extract description
    const description = this.extractDescription(cleanTranscript, amount);
    
    // Use fallback categorization for category prediction if we have description
    let category: string | undefined;
    if (description) {
      try {
        category = this.categorizeDescription(description);
      } catch (error) {
        console.warn('Categorization failed:', error);
      }
    }

    return {
      amount,
      description,
      type,
      category,
      confidence: this.calculateConfidence(amount, description, type)
    };
  }

  private extractAmount(transcript: string): number | undefined {
    // Enhanced patterns for Indian currency and speech recognition
    // ORDER MATTERS: Specific patterns first
    const patterns = [
      // Complex patterns first
      // Allow "rupees" between number and "and": "100 rupees and 50 paise"
      /(?:rupees?|rs\.?|₹)?\s*(\d+)\s*(?:(?:rupees?|rs\.?|₹)\s*)?(?:and|&)\s*(\d+)/i, // "50 and 75 paise"

      // "50 point 75"
      /(?:rupees?|rs\.?|₹)?\s*(\d+)\s*(?:point|dot)\s*(\d+)/i,

      // Multipliers with optional decimals
      /(?:rupees?|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:thousand|k)/i,
      /(?:rupees?|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:hundred)/i,
      /(?:rupees?|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac)/i,
      /(?:rupees?|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:crore)/i,

      // Standard currency patterns
      /(?:rupees?|rs\.?|₹)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:rupees?|rs\.?|₹)/i,

      // Fallback for just numbers
      /(\d+(?:,\d{3})*(?:\.\d{2})?)/i
    ];

    for (const pattern of patterns) {
      const match = transcript.match(pattern);
      if (match) {
        let amount = 0;

        // Handle special cases
        if (pattern.source.includes('thousand|k')) {
          amount = parseFloat(match[1]) * 1000;
        } else if (pattern.source.includes('hundred')) {
          amount = parseFloat(match[1]) * 100;
        } else if (pattern.source.includes('lakh|lac')) {
          amount = parseFloat(match[1]) * 100000;
        } else if (pattern.source.includes('crore')) {
          amount = parseFloat(match[1]) * 10000000;
        } else if (pattern.source.includes('point|dot') && match[2]) {
          amount = parseFloat(match[1]) + parseFloat('0.' + match[2]);
        } else if (pattern.source.includes('and|&') && match[2]) {
          amount = parseFloat(match[1]) + parseFloat(match[2]) / 100; // Paise
        } else {
          const amountStr = match[1].replace(/,/g, '');
          amount = parseFloat(amountStr);
        }

        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }

    return undefined;
  }

  private extractTransactionType(transcript: string): 'income' | 'expense' | undefined {
    const expenseKeywords = [
      // Basic expense terms
      'spent', 'spend', 'paid', 'pay', 'bought', 'buy', 'expense', 'cost', 'charge',
      'bill', 'purchase', 'shopping', 'food', 'coffee', 'lunch', 'dinner', 'fuel',
      'petrol', 'diesel', 'grocery', 'medicine', 'doctor', 'hospital',

      // Indian context
      'kharcha', 'kharch', 'diya', 'liya', 'khareed', 'khareedar', 'bill', 'payment',
      'recharge', 'top up', 'topup', 'emi', 'installment', 'subscription',

      // Common places/activities
      'restaurant', 'cafe', 'mall', 'market', 'pharmacy', 'medical store',
      'auto', 'taxi', 'uber', 'ola', 'metro', 'bus', 'train', 'flight',
      'movie', 'cinema', 'theatre', 'gym', 'salon', 'parlour'
    ];

    const incomeKeywords = [
      // Basic income terms
      'received', 'receive', 'earned', 'earn', 'income', 'salary', 'bonus',
      'refund', 'cashback', 'profit', 'dividend', 'interest', 'freelance',

      // Indian context
      'mila', 'aaya', 'credit', 'deposit', 'transfer', 'payment received',
      'commission', 'incentive', 'overtime', 'allowance', 'reimbursement',

      // Business terms
      'sale', 'sold', 'client payment', 'project payment', 'consulting',
      'tuition', 'teaching', 'rent received', 'rental income'
    ];

    const lowerTranscript = transcript.toLowerCase();

    // Check for explicit income keywords first
    if (incomeKeywords.some(keyword => lowerTranscript.includes(keyword))) {
      return 'income';
    }

    // Check for expense keywords or default to expense for "add" commands
    if (expenseKeywords.some(keyword => lowerTranscript.includes(keyword)) ||
        lowerTranscript.includes('add')) {
      return 'expense';
    }

    return 'expense'; // Default to expense
  }

  private extractDescription(transcript: string, amount?: number): string | undefined {
    let description = transcript.toLowerCase();

    // Enhanced command words removal (including Indian terms)
    const commandWords = [
      // Basic command words
      'add', 'spent', 'spend', 'paid', 'pay', 'bought', 'buy', 'for',
      'rupees', 'rs', '₹', 'on', 'at', 'in', 'the', 'a', 'an', 'of', 'to', 'from',
      'i', 'we', 'he', 'she', 'they', 'my', 'our', 'received', 'receive', 'gave', 'give',

      // Indian terms
      'kharcha', 'kharch', 'diya', 'liya', 'khareed', 'mila', 'aaya',

      // Amount-related words
      'thousand', 'hundred', 'lakh', 'lac', 'crore', 'point', 'dot', 'and',
      'k', 'paise', 'paisa',

      // Transaction words
      'transaction', 'expense', 'income', 'payment', 'bill', 'cost', 'charge'
    ];

    // Remove amount and related words from description
    if (amount) {
      // Remove the exact amount
      description = description.replace(new RegExp(`\\b${amount}\\b`, 'g'), '');

      // Remove currency symbols and words
      description = description.replace(/rupees?|rs\.?|₹/gi, '');

      // Remove amount-related patterns
      description = description.replace(/\d+(?:\.\d+)?\s*(?:thousand|k|hundred|lakh|lac|crore)/gi, '');
      description = description.replace(/\d+\s*(?:point|dot)\s*\d+/gi, '');
      description = description.replace(/\d+\s*(?:and|&)\s*\d+/gi, '');
    }

    // Remove all standalone numbers that might be amounts
    description = description.replace(/\b\d+(?:,\d{3})*(?:\.\d{2})?\b/g, '');

    // Remove command words
    commandWords.forEach(word => {
      description = description.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    });

    // Clean up extra spaces and punctuation
    description = description.replace(/[,\.;:!?]/g, ' ');
    description = description.replace(/\s+/g, ' ').trim();

    // Capitalize first letter of each word for better readability
    if (description.length > 2) {
      return description.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    return undefined;
  }

  private categorizeDescription(description: string): string {
    const desc = description.toLowerCase();

    const checkKeywords = (keywords: string[]) => {
      return keywords.some(keyword => {
        // Use word boundary check for short words or specific matches
        if (keyword.length <= 3) {
          return new RegExp(`\\b${keyword}\\b`, 'i').test(desc);
        }
        return desc.includes(keyword);
      });
    };

    // Entertainment (Prioritize over bills to avoid mismatches like "movie" vs "vi" in bills)
    if (checkKeywords([
      'movie', 'cinema', 'theatre', 'bookmyshow', 'pvr', 'inox',
      'multiplex', 'concert', 'show', 'event', 'ticket', 'game',
      'sports', 'gym', 'fitness', 'netflix', 'amazon prime', 'hotstar',
      'spotify', 'youtube'
    ])) {
      return 'Entertainment';
    }

    // Food & Dining (Enhanced with Indian terms)
    if (checkKeywords([
      'coffee', 'tea', 'restaurant', 'food', 'cafe', 'lunch', 'dinner',
      'breakfast', 'meal', 'pizza', 'burger', 'sandwich', 'chai', 'dosa',
      'idli', 'biryani', 'thali', 'paratha', 'roti', 'dal', 'rice',
      'swiggy', 'zomato', 'dominos', 'mcdonalds', 'kfc', 'subway',
      'starbucks', 'ccd', 'barista'
    ])) {
      return 'Food & Dining';
    }

    // Transportation (Enhanced with Indian terms)
    if (checkKeywords([
      'fuel', 'petrol', 'diesel', 'gas', 'taxi', 'uber', 'ola', 'bus',
      'metro', 'auto', 'rickshaw', 'rapido', 'train', 'flight', 'airline',
      'parking', 'toll', 'fastag', 'bike', 'scooter', 'car', 'indigo',
      'spicejet', 'irctc'
    ])) {
      return 'Transportation';
    }

    // Shopping (Enhanced with Indian brands)
    if (checkKeywords([
      'shopping', 'clothes', 'shirt', 'shoes', 'bag', 'book',
      'electronics', 'mobile', 'laptop', 'amazon', 'flipkart', 'myntra',
      'ajio', 'nykaa', 'bigbasket', 'grofers', 'blinkit', 'zepto',
      'mall', 'market', 'store', 'reliance', 'dmart', 'more',
      'spencer', 'big bazaar'
    ])) {
      return 'Shopping';
    }

    // Healthcare (Enhanced with Indian terms)
    if (checkKeywords([
      'doctor', 'hospital', 'medicine', 'pharmacy', 'medical', 'health',
      'apollo', 'fortis', 'max', 'aiims', 'clinic', 'checkup', 'test',
      'lab', 'pathology', 'dental', 'dentist', 'eye', 'optical',
      'lenskart', 'titan eye'
    ])) {
      return 'Healthcare';
    }

    // Bills & Utilities (Enhanced with Indian services)
    if (checkKeywords([
      'electricity', 'water', 'internet', 'mobile', 'phone', 'bill',
      'recharge', 'utility', 'broadband', 'wifi', 'jio', 'airtel',
      'vi', 'bsnl', 'idea', 'tata sky', 'dish tv', 'sun direct',
      'd2h'
    ])) {
      return 'Bills & Utilities';
    }

    // Education (New category)
    if (checkKeywords([
      'course', 'class', 'tuition', 'coaching', 'study', 'exam',
      'fee', 'school', 'college', 'university', 'udemy', 'coursera',
      'byju', 'unacademy'
    ])) {
      return 'Education';
    }

    return 'Miscellaneous';
  }

  private calculateConfidence(
    amount?: number,
    description?: string,
    type?: string
  ): number {
    let confidence = 0;

    if (amount && amount > 0) confidence += 0.4;
    if (description && description.length > 2) confidence += 0.3;
    if (type) confidence += 0.3;

    return Math.min(confidence, 1.0);
  }
}

// Global speech recognition instance
let speechService: SpeechRecognitionService | null = null;

export const getSpeechRecognitionService = (): SpeechRecognitionService => {
  if (!speechService) {
    speechService = new SpeechRecognitionService();
  }
  return speechService;
};

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Define SpeechRecognition interface for TypeScript
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  grammars: SpeechGrammarList;

  start(): void;
  stop(): void;
  abort(): void;

  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechGrammarList {
  readonly length: number;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
  addFromURI(src: string, weight?: number): void;
  addFromString(string: string, weight?: number): void;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}
