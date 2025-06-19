import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      environment: process.env.NODE_ENV,
      features: {
        speechToText: {
          googleCloudApi: !!process.env.GOOGLE_GENAI_API_KEY,
          endpoint: '/api/speech-to-text',
          status: 'available'
        },
        ai: {
          geminiApi: !!process.env.GOOGLE_GENAI_API_KEY,
          status: process.env.GOOGLE_GENAI_API_KEY ? 'configured' : 'missing_api_key'
        },
        pwa: {
          manifest: '/manifest.json',
          serviceWorker: '/sw.js',
          status: 'available'
        }
      },
      deployment: {
        platform: process.env.VERCEL ? 'vercel' : 'unknown',
        region: process.env.VERCEL_REGION || 'unknown',
        timestamp: process.env.VERCEL_DEPLOYMENT_ID || 'local'
      }
    };

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 