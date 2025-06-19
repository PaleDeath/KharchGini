"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, Volume2, Check, X, Loader2, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSpeechRecognitionService, VoiceTransactionData } from '@/lib/voice/speech-recognition';
import { useToast } from "@/hooks/use-toast";

interface VoiceTransactionInputProps {
  onTransactionParsed: (data: VoiceTransactionData) => void;
  onCancel?: () => void;
  className?: string;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'result' | 'error' | 'manual';

export function VoiceTransactionInput({ 
  onTransactionParsed, 
  onCancel, 
  className 
}: VoiceTransactionInputProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [parsedData, setParsedData] = useState<VoiceTransactionData | null>(null);
  const [error, setError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const { toast } = useToast();

  const speechService = getSpeechRecognitionService();
  const isSupported = speechService.isVoiceSupported();
  
  // Detect production environment and suggest manual input
  const isProduction = typeof window !== 'undefined' && 
    (window.location.protocol === 'https:' && !window.location.hostname.includes('localhost'));

  // Auto-switch to manual in production environments where voice often fails
  useEffect(() => {
    if (isProduction && !isSupported) {
      setVoiceState('manual');
    }
  }, [isProduction, isSupported]);

  const startListening = async () => {
    if (!isSupported) {
      toast({
        variant: "destructive",
        title: "Voice Not Supported",
        description: "Voice input is not available. Please use the manual input option below."
      });
      setVoiceState('manual');
      return;
    }

    setVoiceState('listening');
    setError('');
    setTranscript('');

    try {
      const result = await speechService.startListening();
      setTranscript(result);
      setVoiceState('processing');
      
      // Parse the voice input
      const parsed = await speechService.parseVoiceInput(result);
      setParsedData(parsed);
      setVoiceState('result');
      
    } catch (error) {
      console.error('Voice recognition error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Voice recognition failed';
      setError(errorMessage);
      setVoiceState('error');

      // For network errors (common in production), auto-switch to manual input
      if (errorMessage.includes('network') || errorMessage.includes('unavailable')) {
        setTimeout(() => {
          setVoiceState('manual');
        }, 2000);
      }

      toast({
        variant: "destructive",
        title: "Voice Recognition Issue",
        description: errorMessage + " Switching to manual input mode...",
        duration: 3000
      });
    }
  };

  const stopListening = () => {
    speechService.stopListening();
    setVoiceState('idle');
  };

  const confirmTransaction = () => {
    if (parsedData) {
      onTransactionParsed(parsedData);
      resetState();
    }
  };

  const resetState = () => {
    setVoiceState('idle');
    setTranscript('');
    setParsedData(null);
    setError('');
    setManualInput('');
  };

  const handleCancel = () => {
    resetState();
    onCancel?.();
  };

  const switchToManual = () => {
    setVoiceState('manual');
    setError('');
  };

  const processManualInput = async () => {
    if (!manualInput.trim()) {
      toast({
        variant: "destructive",
        title: "Input Required",
        description: "Please enter a transaction description."
      });
      return;
    }

    setVoiceState('processing');
    try {
      const parsed = await speechService.parseVoiceInput(manualInput);
      setParsedData(parsed);
      setVoiceState('result');
    } catch (error) {
      console.error('Manual input parsing error:', error);
      setError('Failed to parse input');
      setVoiceState('error');
    }
  };

  if (!isSupported) {
    return (
      <Card className={cn("w-full max-w-md", className)}>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <MicOff className="h-5 w-5 text-muted-foreground" />
            Voice Input Unavailable
          </CardTitle>
          <CardDescription>
            Voice input requires Chrome, Edge, or Safari browser with microphone permissions.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full h-full flex flex-col", className)}>
      <CardHeader className="text-center flex-shrink-0 pb-4">
        <CardTitle className="flex items-center justify-center gap-2 text-lg">
          <Volume2 className="h-5 w-5" />
          Voice Transaction Input
        </CardTitle>
        <CardDescription className="text-sm">
          {voiceState === 'manual'
            ? "Type your transaction like 'Spent 500 rupees on coffee' or 'Received 2000 salary'"
            : "Enhanced voice recognition with Google Cloud AI - speak naturally!"
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-4 p-4">
        {/* Voice State Indicator */}
        <div className="flex justify-center">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
            voiceState === 'listening' && "bg-red-100 animate-pulse",
            voiceState === 'processing' && "bg-blue-100",
            voiceState === 'result' && "bg-green-100",
            voiceState === 'error' && "bg-red-100",
            voiceState === 'manual' && "bg-purple-100",
            voiceState === 'idle' && "bg-gray-100"
          )}>
            {voiceState === 'listening' && <Mic className="h-6 w-6 text-red-600" />}
            {voiceState === 'processing' && <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />}
            {voiceState === 'result' && <Check className="h-6 w-6 text-green-600" />}
            {voiceState === 'error' && <X className="h-6 w-6 text-red-600" />}
            {voiceState === 'manual' && <Type className="h-6 w-6 text-purple-600" />}
            {voiceState === 'idle' && <Mic className="h-6 w-6 text-gray-600" />}
          </div>
        </div>

        {/* Status Text */}
        <div className="text-center">
          {voiceState === 'idle' && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Try voice input or type manually</p>
              <p className="text-xs text-muted-foreground text-purple-600">Manual input recommended for production apps</p>
            </div>
          )}
          {voiceState === 'listening' && (
            <p className="text-sm text-red-600 font-medium">Listening... Speak now</p>
          )}
          {voiceState === 'processing' && (
            <p className="text-sm text-blue-600 font-medium">Processing your input...</p>
          )}
          {voiceState === 'result' && (
            <p className="text-sm text-green-600 font-medium">Transaction parsed successfully!</p>
          )}
          {voiceState === 'manual' && (
            <p className="text-sm text-purple-600 font-medium">Type your transaction below</p>
          )}
          {voiceState === 'error' && (
            <div className="text-center space-y-2">
              <p className="text-sm text-red-600 font-medium">Error: {error}</p>
              <Button
                onClick={switchToManual}
                variant="outline"
                size="sm"
                className="text-purple-600 border-purple-300 hover:bg-purple-50"
              >
                <Type className="h-4 w-4 mr-2" />
                Try Manual Input
              </Button>
            </div>
          )}
        </div>

        {/* Manual Input Field */}
        {voiceState === 'manual' && (
          <div className="space-y-3">
            <Label htmlFor="manual-input">Transaction Description</Label>
            <Input
              id="manual-input"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="e.g., Spent 500 rupees on coffee at Starbucks"
              onKeyPress={(e) => e.key === 'Enter' && processManualInput()}
            />
          </div>
        )}

        {/* Transcript Display */}
        {transcript && voiceState !== 'manual' && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700">You said:</p>
            <p className="text-sm text-gray-900 italic">"{transcript}"</p>
          </div>
        )}

        {/* Parsed Data Display */}
        {parsedData && voiceState === 'result' && (
          <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm font-medium text-green-800">Parsed Transaction:</p>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              {parsedData.amount && (
                <div>
                  <span className="font-medium">Amount:</span>
                  <Badge variant="secondary" className="ml-1">₹{parsedData.amount}</Badge>
                </div>
              )}
              
              {parsedData.type && (
                <div>
                  <span className="font-medium">Type:</span>
                  <Badge 
                    variant={parsedData.type === 'expense' ? 'destructive' : 'default'} 
                    className="ml-1"
                  >
                    {parsedData.type}
                  </Badge>
                </div>
              )}
              
              {parsedData.description && (
                <div className="col-span-2">
                  <span className="font-medium">Description:</span>
                  <span className="ml-1">{parsedData.description}</span>
                </div>
              )}
              
              {parsedData.category && (
                <div className="col-span-2">
                  <span className="font-medium">Category:</span>
                  <Badge variant="outline" className="ml-1">{parsedData.category}</Badge>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-green-200">
              <span className="text-xs text-green-600">
                Confidence: {Math.round(parsedData.confidence * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {voiceState === 'idle' && (
            <>
              <Button onClick={startListening} className="flex-1">
                <Mic className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
              <Button onClick={switchToManual} variant="outline">
                <Type className="h-4 w-4 mr-2" />
                Type Instead
              </Button>
            </>
          )}
          
          {voiceState === 'listening' && (
            <Button onClick={stopListening} variant="destructive" className="flex-1">
              <MicOff className="h-4 w-4 mr-2" />
              Stop Recording
            </Button>
          )}

          {voiceState === 'manual' && (
            <>
              <Button onClick={processManualInput} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                Process Input
              </Button>
              <Button onClick={resetState} variant="outline">
                <Mic className="h-4 w-4 mr-2" />
                Use Voice
              </Button>
            </>
          )}
          
          {voiceState === 'result' && (
            <>
              <Button onClick={confirmTransaction} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
              <Button onClick={resetState} variant="outline">
                <Mic className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </>
          )}
          
          {voiceState === 'processing' && (
            <Button disabled className="flex-1">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </Button>
          )}

          {voiceState === 'error' && (
            <Button onClick={resetState} variant="outline" className="flex-1">
              Try Again
            </Button>
          )}
          
          {onCancel && (
            <Button onClick={handleCancel} variant="ghost" size="sm">
              Cancel
            </Button>
          )}
        </div>

        {/* Enhanced Tips */}
        <div className="text-xs text-muted-foreground space-y-2">
          <p className="font-medium">💡 Tips for better recognition:</p>
          <div className="grid grid-cols-1 gap-2">
            <div className="p-2 bg-blue-50 rounded text-blue-700">
              <p className="font-medium">✨ Enhanced with Google Cloud AI</p>
              <p>Better accuracy for Indian English and financial terms</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">📝 Example phrases:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                <li>"Spent 500 rupees on coffee at Starbucks"</li>
                <li>"Paid 2000 for Uber ride to airport"</li>
                <li>"Received 50000 salary from company"</li>
                <li>"Bought groceries for 1500 at BigBasket"</li>
                <li>"Recharged mobile for 399 rupees"</li>
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-medium">🎯 Supported formats:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                <li>Amounts: "500", "2 thousand", "1.5 lakh"</li>
                <li>Currency: "rupees", "rs", "₹"</li>
                <li>Places: Brand names, locations</li>
                <li>Categories: Auto-detected from description</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
