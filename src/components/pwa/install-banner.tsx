'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Download, Smartphone, Zap, Shield } from 'lucide-react';
import { pwaManager } from '@/lib/pwa/pwa-manager';
import { cn } from '@/lib/utils';

export function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if banner was previously dismissed
    const wasDismissed = localStorage.getItem('pwa-banner-dismissed') === 'true';
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Check if app is already installed
    if (pwaManager.isAppInstalled()) {
      return;
    }

    // Listen for install availability
    const handleInstallAvailable = () => {
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    const handleInstallCompleted = () => {
      setShowBanner(false);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-install-completed', handleInstallCompleted);

    // Show banner after a delay if install prompt is available
    const timer = setTimeout(() => {
      if (pwaManager.canInstall() && !dismissed) {
        setShowBanner(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-install-completed', handleInstallCompleted);
      clearTimeout(timer);
    };
  }, [dismissed]);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const installed = await pwaManager.promptInstall();
      if (installed) {
        setShowBanner(false);
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-banner-dismissed', 'true');
    
    // Auto-show again after 7 days
    setTimeout(() => {
      localStorage.removeItem('pwa-banner-dismissed');
    }, 7 * 24 * 60 * 60 * 1000);
  };

  if (!showBanner || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-blue-50 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Install KharchGini</h3>
                <p className="text-xs text-muted-foreground">Get the app experience</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center">
              <div className="p-2 bg-green-100 rounded-lg mb-1 mx-auto w-fit">
                <Zap className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-xs text-muted-foreground">Faster</p>
            </div>
            <div className="text-center">
              <div className="p-2 bg-blue-100 rounded-lg mb-1 mx-auto w-fit">
                <Shield className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-xs text-muted-foreground">Offline</p>
            </div>
            <div className="text-center">
              <div className="p-2 bg-purple-100 rounded-lg mb-1 mx-auto w-fit">
                <Download className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xs text-muted-foreground">Native</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleInstall}
              disabled={isInstalling}
              className="flex-1 h-9"
              size="sm"
            >
              {isInstalling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Install App
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="h-9"
              size="sm"
            >
              Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PWAUpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      setShowUpdate(true);
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Download className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Update Available</h3>
                <p className="text-xs text-muted-foreground">New features and improvements</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleUpdate}
              className="flex-1 h-9 bg-orange-600 hover:bg-orange-700"
              size="sm"
            >
              Update Now
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="h-9"
              size="sm"
            >
              Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PWAStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setIsInstalled(pwaManager.isAppInstalled());

    const cleanup = pwaManager.onNetworkChange((online) => {
      setIsOnline(online);
    });

    return cleanup;
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <div className="flex flex-col gap-2">
        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-100 text-orange-800 rounded-lg text-sm shadow-sm">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            Offline Mode
          </div>
        )}
        
        {isInstalled && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            App Installed
          </div>
        )}
      </div>
    </div>
  );
}
