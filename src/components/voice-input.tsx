"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, Loader2, MicOff } from "lucide-react";
import { getSpeechRecognitionService, VoiceTransactionData } from "@/lib/voice/speech-recognition";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface VoiceInputProps {
  onVoiceData: (data: VoiceTransactionData) => void;
  className?: string;
}

export function VoiceInput({ onVoiceData, className }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleStartListening = async () => {
    setIsListening(true);
    try {
      const service = getSpeechRecognitionService();
      // Start listening and get transcript
      const transcript = await service.startListening();

      setIsListening(false);
      setIsProcessing(true);

      // Parse the transcript
      const data = await service.parseVoiceInput(transcript);

      onVoiceData(data);

      toast({
        title: "Voice Input Processed",
        description: "Transaction details have been auto-filled.",
      });
    } catch (error) {
      console.error("Voice input error:", error);
      // Don't show toast for simple cancellations or no-speech if user just closed it
      if (error instanceof Error && error.message !== 'No speech detected. Please try speaking again or use the "Type Instead" option below.') {
         toast({
          variant: "destructive",
          title: "Voice Input Failed",
          description: error instanceof Error ? error.message : "Failed to process voice input",
        });
      }
    } finally {
      setIsListening(false);
      setIsProcessing(false);
    }
  };

  const handleStopListening = () => {
    try {
      const service = getSpeechRecognitionService();
      service.stopListening();
      setIsListening(false);
    } catch (error) {
      console.error("Error stopping voice input:", error);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={isListening ? "destructive" : "outline"}
            size="icon"
            className={cn("h-8 w-8 transition-all duration-200", isListening && "animate-pulse", className)}
            onClick={isListening ? handleStopListening : handleStartListening}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            <span className="sr-only">
              {isListening ? "Stop listening" : "Start voice input"}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isListening ? "Stop listening" : "Use voice input"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
