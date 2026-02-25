"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, Loader2, Check, X, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSpeechRecognitionService, VoiceTransactionData } from '@/lib/voice/speech-recognition';
import { useToast } from "@/hooks/use-toast";
import { UseFormSetValue } from "react-hook-form";

interface VoiceInputProps {
  setValue: UseFormSetValue<any>;
  className?: string;
  onTranscriptionComplete?: (data: VoiceTransactionData) => void;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'result' | 'error';

export function VoiceInput({
  setValue,
  className,
  onTranscriptionComplete
}: VoiceInputProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [parsedData, setParsedData] = useState<VoiceTransactionData | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();

  // Ref to track if component is mounted
  const isMounted = useRef(true);

  const speechService = getSpeechRecognitionService();
  const isSupported = speechService.isVoiceSupported();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Ensure we stop listening if component unmounts
      try {
        speechService.stopListening();
      } catch (e) {
        // Ignore errors during cleanup
      }
    };
  }, [speechService]);

  const startListening = async () => {
    if (!isSupported) {
      toast({
        variant: "destructive",
        title: "Voice Not Supported",
        description: "Voice input is not available in your browser."
      });
      return;
    }

    setVoiceState('listening');
    setTranscript('');
    setParsedData(null);

    try {
      const result = await speechService.startListening();
      if (!isMounted.current) return;

      setTranscript(result);
      setVoiceState('processing');

      const parsed = await speechService.parseVoiceInput(result);
      if (!isMounted.current) return;

      setParsedData(parsed);
      setVoiceState('result');
      setShowConfirmation(true);

    } catch (error) {
      if (!isMounted.current) return;

      console.error('Voice input error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Voice recognition failed';

      // Only show toast for non-cancellation errors
      if (!errorMessage.includes('aborted')) {
        toast({
          variant: "destructive",
          title: "Voice Error",
          description: errorMessage
        });
      }
      setVoiceState('error');

      // Reset state after a delay
      setTimeout(() => {
        if (isMounted.current && voiceState === 'error') {
          setVoiceState('idle');
        }
      }, 3000);
    }
  };

  const stopListening = () => {
    try {
      speechService.stopListening();
      // We don't manually set state to idle here because startListening promise
      // will resolve/reject and update the state accordingly.
    } catch (error) {
      console.error("Error stopping speech recognition:", error);
    }
  };

  const handleConfirm = () => {
    if (parsedData) {
      // Auto-fill form fields
      if (parsedData.amount !== undefined && parsedData.amount !== null) {
        setValue('amount', parsedData.amount);
      }
      if (parsedData.description) {
        setValue('description', parsedData.description);
      }
      if (parsedData.category) {
        setValue('category', parsedData.category);
      }
      if (parsedData.type) {
        setValue('type', parsedData.type);
      }

      if (onTranscriptionComplete) {
        onTranscriptionComplete(parsedData);
      }

      toast({
        title: "Form Updated",
        description: "Transaction details have been filled automatically."
      });

      setShowConfirmation(false);
      setVoiceState('idle');
      setParsedData(null);
      setTranscript('');
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setVoiceState('idle');
    setParsedData(null);
    setTranscript('');
  };

  // If not supported, don't render anything
  if (!isSupported) return null;

  return (
    <>
      <div className={cn("fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2", className)}>
        {/* Transcript Preview */}
        {voiceState === 'listening' && (
           <Card className="mb-2 w-64 animate-in fade-in slide-in-from-bottom-4">
             <CardContent className="p-3 text-sm text-center">
               <div className="flex items-center justify-center gap-2 mb-1">
                 <span className="relative flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                 </span>
                 <span className="font-medium text-red-500">Listening...</span>
               </div>
               <p className="text-muted-foreground text-xs">Speak clearly now</p>
             </CardContent>
           </Card>
        )}

        {/* Floating Action Button */}
        <Button
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full shadow-lg transition-all duration-300",
            voiceState === 'listening' ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-primary hover:bg-primary/90",
            voiceState === 'processing' && "bg-blue-500 hover:bg-blue-600"
          )}
          onClick={voiceState === 'listening' ? stopListening : startListening}
          disabled={voiceState === 'processing'}
        >
          {voiceState === 'listening' ? (
            <MicOff className="h-6 w-6" />
          ) : voiceState === 'processing' ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Did you mean?</DialogTitle>
            <DialogDescription>
              We parsed the following details from your voice input.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {transcript && (
              <div className="p-3 bg-muted rounded-lg text-sm italic text-muted-foreground">
                "{transcript}"
              </div>
            )}

            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount
                </Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    id="amount"
                    value={parsedData?.amount || ''}
                    onChange={(e) => setParsedData(prev => prev ? {...prev, amount: parseFloat(e.target.value) || 0} : null)}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="desc" className="text-right">
                  Desc
                </Label>
                <div className="col-span-3">
                  <Input
                    id="desc"
                    value={parsedData?.description || ''}
                    onChange={(e) => setParsedData(prev => prev ? {...prev, description: e.target.value} : null)}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">
                  Category
                </Label>
                <div className="col-span-3">
                  <Input
                    id="category"
                    value={parsedData?.category || ''}
                    onChange={(e) => setParsedData(prev => prev ? {...prev, category: e.target.value} : null)}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                <div className="col-span-3 flex gap-2">
                  <Badge
                    variant={parsedData?.type === 'expense' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setParsedData(prev => prev ? {...prev, type: 'expense'} : null)}
                  >
                    Expense
                  </Badge>
                  <Badge
                    variant={parsedData?.type === 'income' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setParsedData(prev => prev ? {...prev, type: 'income'} : null)}
                  >
                    Income
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                setShowConfirmation(false);
                startListening();
              }}>
                <Mic className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button type="submit" size="sm" onClick={handleConfirm}>
                <Check className="h-4 w-4 mr-2" />
                Confirm & Fill
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
