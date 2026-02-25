"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, X, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { parseCommand, ParsedTransaction } from "@/lib/voiceParser";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface VoiceInputProps {
  onVoiceData: (data: ParsedTransaction) => void;
  className?: string;
}

export function VoiceInput({ onVoiceData, className }: VoiceInputProps) {
  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    error,
    supported
  } = useSpeechRecognition();

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedTransaction | null>(null);
  const [finalTranscript, setFinalTranscript] = useState('');
  const lastProcessedTranscript = useRef('');
  const { toast } = useToast();

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Voice Error",
        description: error
      });
      setShowConfirmation(false);
    }
  }, [error, toast]);

  // Handle auto-stop or manual stop
  useEffect(() => {
    if (!isListening && transcript && !showConfirmation) {
      if (transcript !== lastProcessedTranscript.current) {
        handleParse(transcript);
      }
    }
  }, [isListening, transcript, showConfirmation]);

  const handleParse = (text: string) => {
    if (!text.trim()) return;

    lastProcessedTranscript.current = text;
    setFinalTranscript(text);
    const result = parseCommand(text);
    setParsedData(result);
    setShowConfirmation(true);
  };

  const handleStart = () => {
    setParsedData(null);
    setShowConfirmation(false);
    startListening();
  };

  const handleStop = () => {
    stopListening();
  };

  const handleConfirm = () => {
    if (parsedData) {
      onVoiceData(parsedData);
      setShowConfirmation(false);
      setParsedData(null);
      setFinalTranscript('');
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setParsedData(null);
    setFinalTranscript('');
    // We do NOT clear lastProcessedTranscript here, so we don't re-process the current transcript
  };

  if (!supported) return null;

  return (
    <>
      <div className={cn("fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2", className)}>
        {/* Live Transcript Preview */}
        {isListening && (
           <Card className="mb-2 w-64 animate-in fade-in slide-in-from-bottom-4 shadow-lg border-primary/20 bg-background/95 backdrop-blur-sm">
             <CardContent className="p-3 text-sm text-center">
               <div className="flex items-center justify-center gap-2 mb-2">
                 <span className="relative flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                 </span>
                 <span className="font-medium text-red-500 text-xs uppercase tracking-wider">Listening</span>
               </div>
               <p className="text-foreground/80 italic min-h-[1.5rem] break-words">
                 "{transcript || '...'}"
               </p>
             </CardContent>
           </Card>
        )}

        {/* Floating Action Button */}
        <Button
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95",
            isListening
              ? "bg-red-500 hover:bg-red-600 animate-pulse ring-4 ring-red-500/30"
              : "bg-primary hover:bg-primary/90"
          )}
          onClick={isListening ? handleStop : handleStart}
        >
          {isListening ? (
            <MicOff className="h-6 w-6 text-white" />
          ) : (
            <Mic className="h-6 w-6 text-white" />
          )}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={(open) => {
        if (!open) handleCancel();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Did you mean?</DialogTitle>
            <DialogDescription>
              Verify the details parsed from your voice input.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {finalTranscript && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm italic text-muted-foreground border border-border/50">
                "{finalTranscript}"
              </div>
            )}

            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right font-medium">
                  Amount
                </Label>
                <div className="col-span-3">
                  <Input
                    id="amount"
                    type="number"
                    value={parsedData?.amount || ''}
                    onChange={(e) => setParsedData(prev => prev ? {...prev, amount: parseFloat(e.target.value) || 0} : null)}
                    className="h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="desc" className="text-right font-medium">
                  Desc
                </Label>
                <div className="col-span-3">
                  <Input
                    id="desc"
                    value={parsedData?.description || ''}
                    onChange={(e) => setParsedData(prev => prev ? {...prev, description: e.target.value} : null)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right font-medium">
                  Category
                </Label>
                <div className="col-span-3">
                  <Input
                    id="category"
                    value={parsedData?.category || ''}
                    onChange={(e) => setParsedData(prev => prev ? {...prev, category: e.target.value} : null)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right font-medium">
                  Type
                </Label>
                <div className="col-span-3 flex gap-2">
                  <Badge
                    variant={parsedData?.type === 'expense' ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1"
                    onClick={() => setParsedData(prev => prev ? {...prev, type: 'expense'} : null)}
                  >
                    Expense
                  </Badge>
                  <Badge
                    variant={parsedData?.type === 'income' ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1"
                    onClick={() => setParsedData(prev => prev ? {...prev, type: 'income'} : null)}
                  >
                    Income
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-between gap-2 flex-col-reverse sm:flex-row">
            <Button variant="ghost" size="sm" onClick={handleCancel} className="w-full sm:w-auto">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={handleStart} className="flex-1 sm:flex-none">
                <Mic className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button type="submit" size="sm" onClick={handleConfirm} className="flex-1 sm:flex-none">
                <Check className="h-4 w-4 mr-2" />
                Confirm
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
