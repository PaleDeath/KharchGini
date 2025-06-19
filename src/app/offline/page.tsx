'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WifiOff, RefreshCw, Home, TrendingUp, Target, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    if (isOnline) {
      window.location.href = '/dashboard';
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Main Offline Card */}
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <WifiOff className="h-8 w-8 text-gray-600" />
            </div>
            <CardTitle className="text-xl">You're Offline</CardTitle>
            <CardDescription>
              {isOnline 
                ? "Connection restored! You can now access all features."
                : "No internet connection. Some features are limited in offline mode."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`flex items-center justify-center gap-2 p-3 rounded-lg ${
              isOnline ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-orange-500 animate-pulse'
              }`} />
              <span className="text-sm font-medium">
                {isOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <Button 
              onClick={handleRetry} 
              className="w-full"
              variant={isOnline ? "default" : "outline"}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {isOnline ? 'Go to Dashboard' : 'Try Again'}
            </Button>
          </CardContent>
        </Card>

        {/* Available Offline Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Offline</CardTitle>
            <CardDescription>
              These features work without an internet connection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/dashboard" className="block">
                <div className="p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <Home className="h-5 w-5 text-blue-600 mb-2" />
                  <p className="text-sm font-medium">Dashboard</p>
                  <p className="text-xs text-muted-foreground">View cached data</p>
                </div>
              </Link>

              <Link href="/transactions" className="block">
                <div className="p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <CreditCard className="h-5 w-5 text-green-600 mb-2" />
                  <p className="text-sm font-medium">Transactions</p>
                  <p className="text-xs text-muted-foreground">Add & view</p>
                </div>
              </Link>

              <Link href="/analytics" className="block">
                <div className="p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <TrendingUp className="h-5 w-5 text-purple-600 mb-2" />
                  <p className="text-sm font-medium">Analytics</p>
                  <p className="text-xs text-muted-foreground">Cached reports</p>
                </div>
              </Link>

              <Link href="/goals" className="block">
                <div className="p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <Target className="h-5 w-5 text-orange-600 mb-2" />
                  <p className="text-sm font-medium">Goals</p>
                  <p className="text-xs text-muted-foreground">Track progress</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Offline Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Offline Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <span>Transactions added offline will sync when you're back online</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <span>Cached data may not reflect the latest changes</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                <span>AI features require an internet connection</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* App Info */}
        <div className="text-center text-sm text-muted-foreground">
          <p>KharchGini • Personal Finance Manager</p>
          <p>Designed to work offline</p>
        </div>
      </div>
    </div>
  );
}
