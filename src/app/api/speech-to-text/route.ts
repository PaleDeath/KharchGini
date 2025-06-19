import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';

// Initialize Google Cloud Speech client
let speechClient: SpeechClient | null = null;

function getSpeechClient(): SpeechClient {
  if (!speechClient) {
    // Check if we have Google Cloud credentials
    const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                          process.env.GOOGLE_CLOUD_PROJECT_ID;

    if (!hasCredentials) {
      throw new Error('Google Cloud Speech-to-Text API credentials not configured. Please set up Google Cloud credentials in your .env file.');
    }

    try {
      // Initialize with project ID and credentials file
      const clientConfig: any = {};

      if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
        clientConfig.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
      }

      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        clientConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      }

      speechClient = new SpeechClient(clientConfig);
    } catch (error) {
      throw new Error(`Failed to initialize Google Cloud Speech client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return speechClient;
}

export async function POST(request: NextRequest) {
  try {
    const { audioData, config, audioFormat, audioSize } = await request.json();

    if (!audioData) {
      return NextResponse.json(
        { success: false, error: 'No audio data provided' },
        { status: 400 }
      );
    }

    console.log('Received audio data:', {
      format: audioFormat,
      size: audioSize,
      dataLength: audioData.length
    });

    try {
      // Try Google Cloud Speech-to-Text API first
      console.log('Initializing Google Cloud Speech client...');
      const client = getSpeechClient();
      console.log('Speech client initialized successfully');

      // Convert base64 audio to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      console.log(`Audio buffer size: ${audioBuffer.length} bytes`);

      // Determine encoding based on audio format
      let encoding: string = 'WEBM_OPUS';
      let sampleRate = 48000;

      if (audioFormat) {
        console.log('Detected audio format:', audioFormat);
        if (audioFormat.includes('opus')) {
          encoding = 'WEBM_OPUS';
          sampleRate = 48000;
        } else if (audioFormat.includes('webm')) {
          encoding = 'WEBM_OPUS'; // Default for WebM
          sampleRate = 48000;
        } else if (audioFormat.includes('mp4') || audioFormat.includes('m4a')) {
          encoding = 'MP3'; // MP4 container often uses MP3 or AAC
          sampleRate = 44100;
        } else {
          console.log('Unknown audio format, using default WEBM_OPUS');
        }
      }

      console.log('Using encoding:', encoding, 'with sample rate:', sampleRate);

      const speechConfig = {
        encoding: encoding as any,
        sampleRateHertz: sampleRate,
        languageCode: 'en-IN', // Indian English for better recognition of Indian terms
        alternativeLanguageCodes: ['en-US', 'hi-IN'], // Fallback languages
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        model: 'latest_long', // Use latest model for better accuracy
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
        console.warn('Audio buffer is very small:', audioBuffer.length, 'bytes - may not contain speech');
      }

      console.log('Sending request to Google Cloud Speech API with config:', speechConfig);
      const [response] = await client.recognize(request);
      console.log('Received response from Google Cloud Speech API:', JSON.stringify(response, null, 2));

      if (!response.results || response.results.length === 0) {
        console.log('No speech results found in response');
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

      console.log(`Transcription successful: "${transcription}" (confidence: ${confidence})`);

      return NextResponse.json({
        success: true,
        transcript: transcription,
        confidence: confidence,
        provider: 'google-cloud'
      });
      
    } catch (speechError) {
      console.error('Google Cloud Speech-to-Text failed:', speechError);
      console.error('Error details:', {
        message: speechError instanceof Error ? speechError.message : 'Unknown error',
        stack: speechError instanceof Error ? speechError.stack : undefined,
        name: speechError instanceof Error ? speechError.name : undefined
      });

      // Fallback to browser-based recognition indication
      return NextResponse.json({
        success: false,
        error: `Cloud speech recognition failed: ${speechError instanceof Error ? speechError.message : 'Unknown error'}`,
        fallback: true
      });
    }
    
  } catch (error) {
    console.error('Speech-to-text processing error:', error);
    
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
    console.error('Streaming config error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to configure streaming' 
      },
      { status: 500 }
    );
  }
}
