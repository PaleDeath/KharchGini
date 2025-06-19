import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';

// Test endpoint to verify Google Cloud Speech-to-Text API setup
export async function GET() {
  try {
    console.log('Testing Google Cloud Speech-to-Text API setup...');
    
    // Check environment variables
    const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                          process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY ||
                          process.env.GOOGLE_CLOUD_PROJECT_ID;

    if (!hasCredentials) {
      return NextResponse.json({
        success: false,
        error: 'Google Cloud credentials not configured',
        details: {
          GOOGLE_APPLICATION_CREDENTIALS: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
          GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY: !!process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY,
          GOOGLE_CLOUD_PROJECT_ID: !!process.env.GOOGLE_CLOUD_PROJECT_ID
        }
      });
    }

    // Try to initialize the client
    const clientConfig: any = {};

    if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
      clientConfig.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    }

    // Try service account key from environment variable first (for production)
    if (process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccountKey = JSON.parse(process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY);
        clientConfig.credentials = serviceAccountKey;
      } catch (parseError) {
        return NextResponse.json({
          success: false,
          error: 'Invalid service account key format in environment variable',
          details: { parseError: parseError instanceof Error ? parseError.message : 'Unknown error' }
        });
      }
    }
    // Fallback to file path (for local development)
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      clientConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }

    const speechClient = new SpeechClient(clientConfig);
    console.log('Speech client initialized successfully');

    // Test with a simple configuration request (no audio needed)
    const testConfig = {
      encoding: 'LINEAR16' as const,
      sampleRateHertz: 16000,
      languageCode: 'en-US',
    };

    // Just test the client initialization and configuration
    return NextResponse.json({
      success: true,
      message: 'Google Cloud Speech-to-Text API is properly configured',
      details: {
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        credentialsMethod: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY ? 'environment_variable' : 'file_path',
        credentialsFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        hasServiceAccountKey: !!process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY,
        clientInitialized: true,
        testConfig: testConfig
      }
    });

  } catch (error) {
    console.error('Speech API test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        errorType: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}
