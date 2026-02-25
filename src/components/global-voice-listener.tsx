"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useVoiceShortcuts } from '@/hooks/useVoiceShortcuts';
import { AddTransactionDialog } from '@/components/add-transaction-dialog';
import { VoiceTransactionData } from '@/lib/voice/speech-recognition';
import { Mic, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function GlobalVoiceListener() {
  const {
    isListening,
    transcript,
    voiceData,
    isVoiceModeActive,
    resetVoiceState,
    isLoading,
    error
  } = useVoiceShortcuts();

  const pathname = usePathname();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'voice'>('manual');
  const [voiceDataForDialog, setVoiceDataForDialog] = useState<VoiceTransactionData | null>(null);
  const { toast } = useToast();

  // Handle voice result
  useEffect(() => {
    if (voiceData && isVoiceModeActive) {
      // Determine action based on context
      if (pathname === '/dashboard') {
        // Quick Add Mode: Open Dialog in 'manual' mode with pre-filled data
        setVoiceDataForDialog(voiceData);
        setActiveTab('manual');
        setDialogOpen(true);
        resetVoiceState();
      } else if (pathname === '/transactions') {
        // Full Form Mode
        setVoiceDataForDialog(voiceData);
        setActiveTab('manual');
        setDialogOpen(true);
        resetVoiceState();
      } else {
        // Default behavior
        setVoiceDataForDialog(voiceData);
        setActiveTab('manual');
        setDialogOpen(true);
        resetVoiceState();
      }
    }
  }, [voiceData, isVoiceModeActive, pathname, resetVoiceState]);

  // Handle errors
  useEffect(() => {
    if (error && isVoiceModeActive) {
      toast({
        variant: "destructive",
        title: "Voice Error",
        description: error
      });
    }
  }, [error, isVoiceModeActive, toast]);

  // Handle closing dialog
  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setVoiceDataForDialog(null);
    }
  };

  // If voice mode is active but not listening/loading yet (waiting for wake word or just started)
  if (!isVoiceModeActive && !dialogOpen) return null;

  return (
    <>
      {/* Voice Overlay */}
      {isVoiceModeActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-background p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 max-w-md w-full mx-4 border border-border">
            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
              isListening ? "bg-red-100 animate-pulse ring-4 ring-red-50" : "bg-muted",
              isLoading && "bg-blue-100 animate-pulse"
            )}>
              {isLoading ? (
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              ) : (
                <Mic className={cn("w-10 h-10", isListening ? "text-red-600" : "text-muted-foreground")} />
              )}
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">
                {isLoading ? "Processing..." : isListening ? "Listening..." : "Voice Active"}
              </h3>
              <p className="text-muted-foreground min-h-[1.5em] text-center">
                {transcript || (isListening ? "Say 'Add expense' or describe a transaction..." : "Ready")}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm w-full text-center">
                {error}
              </div>
            )}

            <Button
              variant="outline"
              className="mt-2 rounded-full px-8"
              onClick={resetVoiceState}
            >
              Cancel
            </Button>

            <p className="text-xs text-muted-foreground mt-4">
              Hold <strong>V</strong> for 2s to activate
            </p>
          </div>
        </div>
      )}

      {/* Global Add Transaction Dialog */}
      <AddTransactionDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        defaultTab={activeTab}
        initialData={voiceDataForDialog}
        onTransactionAdded={() => {
          toast({
            title: "Success",
            description: "Transaction added successfully"
          });
          // Note: Data refresh relies on user action or optimistic updates in local hooks if they were shared.
          // Since we use separate hook instances, the list might not update immediately without a reload/refetch trigger.
          // Ideally, we'd use a global context for data, but that's out of scope.
        }}
      />
    </>
  );
}
