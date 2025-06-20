import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  // Disable output file tracing (fixes EPERM: operation not permitted, open '.next/trace' on Windows)
  outputFileTracing: false,
  typescript: {
    ignoreBuildErrors: false, // Enable type checking for production
  },
  eslint: {
    ignoreDuringBuilds: false, // Enable linting for production
  },
  // Ensure static files in public directory are properly served
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  // Disable trace generation to prevent EPERM errors on Windows
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  
  // Disable tracing completely on Windows to prevent EPERM errors
  experimental: {
    // Disable filesystem watching optimizations that can cause issues on Windows
    optimizeCss: false,
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
    'handlebars',
    'mime',
    'mime-types',
    'mime-db'
  ],
  // Enhanced webpack configuration for Windows compatibility
  webpack: (config, { dev, isServer }) => {
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
      mime: false,
      'mime-types': false,
      'mime-db': false,
    };
    
    // Windows-specific optimizations
    if (process.platform === 'win32') {
      // Disable caching in development to prevent file lock issues
      if (dev) {
        config.cache = false;
      }
      
      // Configure file watching for Windows
      config.watchOptions = {
        ignored: ['**/.next/**', '**/node_modules/**'],
        aggregateTimeout: 300,
        poll: 1000, // Use polling on Windows for better stability
      };
      
      // Optimize file system operations
      config.snapshot = {
        managedPaths: [],
        immutablePaths: [],
        buildDependencies: {
          hash: false,
          timestamp: true,
        },
      };
      
      // Reduce file system pressure
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          cacheGroups: {
            ...config.optimization?.splitChunks?.cacheGroups,
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      };
    }
    
    return config;
  },
};

export default nextConfig;
