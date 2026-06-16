"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, MicOff, ExternalLink, Type } from "lucide-react";

interface Props {
  children: ReactNode;
  onManualInput?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isIOS: boolean;
  isSafari: boolean;
}

export class SpeechErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isIOS: false,
    isSafari: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SpeechErrorBoundary caught an error:", error, errorInfo);

    // Track error types in localStorage for debugging
    if (typeof window !== "undefined") {
      try {
        const errorLog = JSON.parse(localStorage.getItem("speech_errors") || "[]");
        errorLog.push({
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        });
        // Keep only last 20 errors
        if (errorLog.length > 20) errorLog.shift();
        localStorage.setItem("speech_errors", JSON.stringify(errorLog));
      } catch (e) {
        console.error("Failed to log speech error to localStorage", e);
      }
    }
  }

  public componentDidMount() {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua); // Basic check, Chrome on iOS also has Safari in UA but is distinct

      // More robust Safari check
      const isChrome = /Chrome/.test(ua);
      const isSafariBrowser = isSafari && !isChrome;

      this.setState({ isIOS, isSafari: isSafariBrowser });
    }
  }

  private handleManualInput = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onManualInput) {
      this.props.onManualInput();
    }
  };

  public render() {
    if (this.state.hasError) {
      const { isIOS, isSafari } = this.state;
      const errorMessage = this.state.error?.message || "An unknown error occurred.";

      return (
        <Card className="w-full border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <MicOff className="h-5 w-5" />
              Microphone Not Available
            </CardTitle>
            <CardDescription>
              We encountered an issue accessing your microphone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="text-sm">
                {errorMessage}
              </AlertDescription>
            </Alert>

            {/* iOS Safari Detection Message */}
            {(isIOS || isSafari) && (
              <div className="p-3 bg-blue-50 text-blue-800 rounded-md text-sm border border-blue-200">
                <p className="font-medium mb-1">💡 Browser Suggestion</p>
                <p>
                  Voice features work best on <strong>Google Chrome</strong>.
                  {isIOS ? " On iOS, please switch to Chrome app." : " Please try using Chrome."}
                </p>
              </div>
            )}

            {/* Permissions Instructions */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">To enable microphone access:</p>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>Check your browser settings to allow microphone access.</li>
                <li>
                  For Chrome, paste this into your address bar:
                  <code className="block mt-1 p-1 bg-muted rounded text-xs break-all select-all cursor-text">
                    chrome://settings/content/microphone
                  </code>
                </li>
                <li>Ensure your system microphone is not muted.</li>
              </ol>
            </div>

            <div className="pt-2">
              <Button
                onClick={this.handleManualInput}
                className="w-full"
                variant="default"
              >
                <Type className="mr-2 h-4 w-4" />
                Enter Manually Instead
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
