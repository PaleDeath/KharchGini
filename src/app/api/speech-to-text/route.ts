import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';

// Initialize Google Cloud Speech client
let speechClient: SpeechClient | null = null;

function getSpeechClient(): SpeechClient {
  if (!speechClient) {
    // Check if we have Google Cloud credentials
    const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                          process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY ||
                          process.env.GOOGLE_CLOUD_PROJECT_ID;

    if (!hasCredentials) {
      throw new Error('Google Cloud Speech-to-Text API credentials not configured. Please set up Google Cloud credentials in your .env file.');
    }

    try {
      // Initialize with project ID and credentials
      const clientConfig: any = {};

      if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
        clientConfig.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        console.log('✅ Using project ID:', process.env.GOOGLE_CLOUD_PROJECT_ID);
      }

      // Try service account key from environment variable first (for production)
      if (process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY) {
        try {
          // Remove any extra whitespace and handle potential encoding issues
          const rawCredentials = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY;
          console.log('🔧 Raw credentials type:', typeof rawCredentials);
          console.log('🔧 Raw credentials length:', rawCredentials?.length || 0);
          console.log('🔧 Raw credentials first 100 chars:', rawCredentials?.substring(0, 100) || 'undefined');
          
          const cleanCredentials = rawCredentials.trim();
          console.log('🔧 Clean credentials length:', cleanCredentials.length);
          console.log('🔧 Clean credentials starts with {:', cleanCredentials.startsWith('{'));
          console.log('🔧 Clean credentials ends with }:', cleanCredentials.endsWith('}'));
          
          if (!cleanCredentials.startsWith('{') || !cleanCredentials.endsWith('}')) {
            throw new Error(`Invalid JSON format in GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY. Expected JSON object, got: ${cleanCredentials.substring(0, 100)}...`);
          }
          
          const serviceAccountKey = JSON.parse(cleanCredentials);
          
          // Fix common issue: private_key contains literal \n which must be actual newlines
          if (serviceAccountKey.private_key && serviceAccountKey.private_key.includes('\\n')) {
            serviceAccountKey.private_key = serviceAccountKey.private_key.replace(/\\n/g, '\n');
            console.log('🔧 Sanitized private_key newlines');
          }
          
          // Validate required fields
          if (!serviceAccountKey.type || !serviceAccountKey.project_id || !serviceAccountKey.private_key_id) {
            throw new Error('Invalid service account key: missing required fields (type, project_id, private_key_id)');
          }
          
          clientConfig.credentials = serviceAccountKey;
          console.log('✅ Using service account key from GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY');
          console.log('✅ Service account email:', serviceAccountKey.client_email);
          console.log('✅ Project ID from credentials:', serviceAccountKey.project_id);
        } catch (parseError) {
          console.error('❌ Failed to parse GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY:', parseError);
          console.error('❌ Raw value type:', typeof process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY);
          console.error('❌ Raw value length:', process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY?.length);
          throw new Error(`Invalid service account key format in GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
        }
      }
      // Check if GOOGLE_APPLICATION_CREDENTIALS contains JSON (Vercel deployment)
      else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
          // Remove any extra whitespace and handle potential encoding issues
          const rawCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
          console.log('🔧 GOOGLE_APPLICATION_CREDENTIALS type:', typeof rawCredentials);
          console.log('🔧 GOOGLE_APPLICATION_CREDENTIALS length:', rawCredentials?.length || 0);
          
          const cleanCredentials = rawCredentials.trim();
          
          // Check if it starts with { to determine if it's JSON
          if (cleanCredentials.startsWith('{')) {
            console.log('🔧 Treating GOOGLE_APPLICATION_CREDENTIALS as JSON');
            
            if (!cleanCredentials.endsWith('}')) {
              throw new Error(`Invalid JSON format in GOOGLE_APPLICATION_CREDENTIALS. Expected JSON object, got incomplete JSON.`);
            }
            
            const serviceAccountKey = JSON.parse(cleanCredentials);
            
            // Fix common issue: private_key contains literal \n which must be actual newlines
            if (serviceAccountKey.private_key && serviceAccountKey.private_key.includes('\\n')) {
              serviceAccountKey.private_key = serviceAccountKey.private_key.replace(/\\n/g, '\n');
              console.log('🔧 Sanitized private_key newlines');
            }
            
            // Validate required fields
            if (!serviceAccountKey.type || !serviceAccountKey.project_id || !serviceAccountKey.private_key_id) {
              throw new Error('Invalid service account key: missing required fields (type, project_id, private_key_id)');
            }
            
            clientConfig.credentials = serviceAccountKey;
            console.log('✅ Using service account key from GOOGLE_APPLICATION_CREDENTIALS (JSON)');
            console.log('✅ Service account email:', serviceAccountKey.client_email);
          } else {
            // Treat as file path (local development)
            console.log('🔧 Treating GOOGLE_APPLICATION_CREDENTIALS as file path');
            clientConfig.keyFilename = cleanCredentials;
            console.log('✅ Using service account key from file:', cleanCredentials);
          }
        } catch (parseError) {
          console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS:', parseError);
          console.error('❌ Raw value type:', typeof process.env.GOOGLE_APPLICATION_CREDENTIALS);
          console.error('❌ Raw value length:', process.env.GOOGLE_APPLICATION_CREDENTIALS?.length);
          throw new Error(`Invalid service account key format in GOOGLE_APPLICATION_CREDENTIALS: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
        }
      }

      console.log('🚀 Initializing Speech Client with config:', JSON.stringify({
        projectId: clientConfig.projectId,
        hasCredentials: !!clientConfig.credentials,
        hasKeyFilename: !!clientConfig.keyFilename,
        credentialsType: clientConfig.credentials ? 'JSON object' : 'file path'
      }, null, 2));

      speechClient = new SpeechClient(clientConfig);
      console.log('✅ Google Cloud Speech client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Cloud Speech client:', error);
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
          console.log('Unknown audio format, using FLAC for maximum compatibility');
          // Use FLAC as the most compatible format
          encoding = 'FLAC';
          sampleRate = 16000;
        }
      } else {
        // Default to FLAC for maximum compatibility
        encoding = 'FLAC';
        sampleRate = 16000;
      }

      console.log('Using encoding:', encoding, 'with sample rate:', sampleRate);

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
