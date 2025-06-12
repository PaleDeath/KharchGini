import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: false, // Enable type checking for production
  },
  eslint: {
    ignoreDuringBuilds: false, // Enable linting for production
  },
  experimental: {
    serverComponentsExternalPackages: ['genkit'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Fix OpenTelemetry build issues
  serverExternalPackages: [
    '@opentelemetry/sdk-node',
    '@opentelemetry/instrumentation',
    '@opentelemetry/exporter-jaeger',
    '@genkit-ai/core',
    'genkit',
    'handlebars'
  ],
  // Fix webpack issues
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore handlebars require.extensions issue on server
      config.externals = config.externals || [];
      config.externals.push('handlebars');
      
      // Ignore OpenTelemetry modules that cause issues
      config.externals.push('@opentelemetry/exporter-jaeger');
    }
    
    // Disable file system permissions for trace files
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };
    
    return config;
  },
};

export default nextConfig;
