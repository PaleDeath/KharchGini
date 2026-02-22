import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';
import { getUserIdFromAuthHeader } from '@/lib/firebase/admin';
import { apiRateLimiter } from '@/lib/rate-limit';
import { validateOriginFromRequest } from '@/lib/csrf-protection';
import { logger } from '@/lib/logger';
import { speechToTextSchema } from '@/lib/validation-schemas';

// Initialize Google Cloud Speech client
let speechClient: SpeechClient | null = null;

function getSpeechClient(): SpeechClient {
  if (!speechClient) {
    const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                          process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY ||
                          process.env.GOOGLE_CLOUD_PROJECT_ID;

    if (!hasCredentials) {
      throw new Error('Google Cloud Speech-to-Text API credentials not configured');
    }

    try {
      const clientConfig: any = {};

      if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
        clientConfig.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
      }

      if (process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY) {
        const cleanCredentials = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY.trim();
        const serviceAccountKey = JSON.parse(cleanCredentials);
        
        if (serviceAccountKey.private_key && serviceAccountKey.private_key.includes('\\n')) {
          serviceAccountKey.private_key = serviceAccountKey.private_key.replace(/\\n/g, '\n');
        }
        
        clientConfig.credentials = serviceAccountKey;
        logger.debug('Speech client using service account key');
      }
      else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const cleanCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
        
        if (cleanCredentials.startsWith('{')) {
          const serviceAccountKey = JSON.parse(cleanCredentials);
          
          if (serviceAccountKey.private_key && serviceAccountKey.private_key.includes('\\n')) {
            serviceAccountKey.private_key = serviceAccountKey.private_key.replace(/\\n/g, '\n');
          }
          
          clientConfig.credentials = serviceAccountKey;
        } else {
          clientConfig.keyFilename = cleanCredentials;
        }
        
        logger.debug('Speech client using application credentials');
      }

      speechClient = new SpeechClient(clientConfig);
      logger.info('Google Cloud Speech client initialized');
    } catch (error) {
      logger.error('Failed to initialize Speech client:', error);
      throw new Error('Failed to initialize Speech service');
    }
  }

  return speechClient;
}

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF Protection
    await validateOriginFromRequest(request);

    // 2. Authentication - Verify Firebase ID token
    const authHeader = request.headers.get('Authorization');
    let userId: string;
    
    try {
      userId = await getUserIdFromAuthHeader(authHeader);
      logger.debug('Speech API authenticated', { userId });
    } catch (authError) {
      logger.warn('Speech API authentication failed', authError);
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 3. Rate Limiting - 10 requests per hour per user
    const rateLimitResult = await apiRateLimiter.limit(userId);
    
    if (!rateLimitResult.success) {
      const resetInMinutes = Math.ceil((rateLimitResult.reset - Date.now()) / 1000 / 60);
      logger.warn('Rate limit exceeded for speech API', {
        userId,
        resetIn: `${resetInMinutes} minutes`,
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Rate limit exceeded. You can make ${rateLimitResult.limit} requests per hour. Try again in ${resetInMinutes} minutes.` 
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
          }
        }
      );
    }

    // 4. Validate request body
    const body = await request.json();
    const validation = speechToTextSchema.safeParse(body);
    
    if (!validation.success) {
      logger.warn('Invalid speech API request', { errors: validation.error.errors });
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { audioData, config, audioFormat, audioSize } = validation.data;

    if (!audioData) {
      return NextResponse.json(
        { success: false, error: 'No audio data provided' },
        { status: 400 }
      );
    }

    logger.debug('Received audio data', {
      userId,
      format: audioFormat,
      size: audioSize,
      dataLength: audioData.length
    });

    try {
      logger.debug('Initializing Google Cloud Speech client');
      const client = getSpeechClient();

      const audioBuffer = Buffer.from(audioData, 'base64');
      logger.debug(`Audio buffer size: ${audioBuffer.length} bytes`);

      // Determine encoding based on audio format
      let encoding: string = 'WEBM_OPUS';
      let sampleRate = 48000;

      if (audioFormat) {
        logger.debug('Detected audio format', { audioFormat });
        if (audioFormat.includes('opus')) {
          // Use OGG_OPUS instead of WEBM_OPUS for better compatibility
          encoding = 'OGG_OPUS';
          sampleRate = 48000;
        } else if (audioFormat.includes('webm')) {
          // For WebM containers, try OGG_OPUS first, then fall back to FLAC
          encoding = 'OGG_OPUS';
          sampleRate = 48000;
        } else if (audioFormat.includes('mp4') || audioFormat.includes('m4a')) {
          encoding = 'MP3';
          sampleRate = 44100;
        } else if (audioFormat.includes('wav')) {
          encoding = 'LINEAR16';
          sampleRate = 16000;
        } else {
          logger.debug('Unknown audio format, using FLAC for maximum compatibility');
          // Use FLAC as the most compatible format
          encoding = 'FLAC';
          sampleRate = 16000;
        }
      } else {
        // Default to FLAC for maximum compatibility
        encoding = 'FLAC';
        sampleRate = 16000;
      }

      logger.debug('Audio encoding configured', { encoding, sampleRate });

      const speechConfig = {
        encoding: encoding as any,
        sampleRateHertz: sampleRate,
        languageCode: 'en-IN', // Indian English for better recognition of Indian terms
        alternativeLanguageCodes: ['en-US', 'hi-IN'], // Fallback languages
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        model: 'latest_short', // Use short model for transaction descriptions
        useEnhanced: true, // Use enhanced model if available
        ...config
      };

      const request = {
        audio: {
          content: audioBuffer,
        },
        config: speechConfig,
      };

      // Validate audio buffer
      if (audioBuffer.length < 1000) {
        logger.warn('Audio buffer is very small - may not contain speech', { 
          size: audioBuffer.length 
        });
      }

      logger.debug('Sending request to Google Cloud Speech API');
      const [response] = await client.recognize(request);
      logger.debug('Received response from Google Cloud Speech API');

      if (!response.results || response.results.length === 0) {
        logger.info('No speech detected in audio', { userId });
        return NextResponse.json({
          success: false,
          error: 'No speech detected in the audio. Please speak clearly and try again, or use the "Type Instead" option.',
          fallback: true
        });
      }

      const transcription = response.results
        .map(result => result.alternatives?.[0]?.transcript || '')
        .join(' ')
        .trim();

      const confidence = response.results[0]?.alternatives?.[0]?.confidence || 0;

      logger.info('Transcription successful', { 
        userId, 
        confidence,
        transcriptLength: transcription.length 
      });

      return NextResponse.json({
        success: true,
        transcript: transcription,
        confidence: confidence,
        provider: 'google-cloud'
      });
      
    } catch (speechError) {
      logger.error('Google Cloud Speech-to-Text failed', speechError);

      // Fallback to browser-based recognition indication
      return NextResponse.json({
        success: false,
        error: `Cloud speech recognition failed: ${speechError instanceof Error ? speechError.message : 'Unknown error'}`,
        fallback: true
      });
    }
    
  } catch (error) {
    logger.error('Speech-to-text processing error', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process speech' 
      },
      { status: 500 }
    );
  }
}

// Handle streaming speech recognition for real-time processing
export async function PUT(request: NextRequest) {
  try {
    const { streamConfig } = await request.json();
    
    // This would be used for streaming recognition
    // For now, return configuration for client-side streaming
    return NextResponse.json({
      success: true,
      streamingSupported: true,
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-IN',
        enableAutomaticPunctuation: true,
        interimResults: true,
        ...streamConfig
      }
    });
    
  } catch (error) {
    logger.error('Streaming config error', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to configure streaming' 
      },
      { status: 500 }
    );
  }
}
