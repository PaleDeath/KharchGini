"use client";

import { useEffect, useState } from 'react';
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Mic, Activity, Clock, Volume2 } from "lucide-react";
import { getVoiceStats, VoiceStats } from '@/lib/voice-tracking';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { VoiceInput } from "@/components/VoiceInput";
import { useToast } from "@/hooks/use-toast";
import { ParsedTransaction } from "@/lib/voiceParser";

export default function SettingsPage() {
  const [stats, setStats] = useState<VoiceStats>({
    voiceCommandsUsed: 0,
    successfulParses: 0,
    averageProcessingTime: 0,
  });

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showTest, setShowTest] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setStats(getVoiceStats());
    // Load preference from localStorage if available
    const saved = localStorage.getItem('voice-enabled');
    if (saved !== null) {
      setVoiceEnabled(saved === 'true');
    }
  }, []);

  const handleToggleVoice = (checked: boolean) => {
    setVoiceEnabled(checked);
    localStorage.setItem('voice-enabled', String(checked));
    toast({
      title: checked ? "Voice Input Enabled" : "Voice Input Disabled",
      description: checked ? "You can now use voice commands to add transactions." : "Voice input features are turned off.",
    });
  };

  const handleTestVoiceData = (data: ParsedTransaction) => {
    toast({
      title: "Test Successful",
      description: `Parsed: ₹${data.amount} for ${data.category} (${data.type})`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="App preferences & usage statistics." />

      {/* Voice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Voice Settings
          </CardTitle>
          <CardDescription>
            Configure how you interact with the voice assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between space-x-2">
            <div className="flex flex-col space-y-1">
              <Label htmlFor="voice-enabled" className="font-medium">Enable Voice Input</Label>
              <span className="text-sm text-muted-foreground">
                Allow using microphone to add transactions hands-free.
              </span>
            </div>
            <Switch
              id="voice-enabled"
              checked={voiceEnabled}
              onCheckedChange={handleToggleVoice}
            />
          </div>

          <div className="flex items-center justify-between space-x-2 pt-4 border-t">
            <div className="flex flex-col space-y-1">
              <Label className="font-medium">Test Microphone</Label>
              <span className="text-sm text-muted-foreground">
                Check if your microphone works and test voice parsing.
              </span>
            </div>
            <div className="flex items-center gap-2">
               {/* Test Button / Indicator */}
               {showTest ? (
                 <div className="flex items-center gap-2">
                   <span className="text-xs text-muted-foreground animate-pulse">Testing...</span>
                   <Button variant="outline" size="sm" onClick={() => setShowTest(false)}>
                     Hide Test
                   </Button>
                 </div>
               ) : (
                 <Button variant="outline" size="sm" onClick={() => setShowTest(true)} disabled={!voiceEnabled}>
                   <Volume2 className="h-4 w-4 mr-2" />
                   Test Mic
                 </Button>
               )}
            </div>
          </div>

          {showTest && (
            <div className="relative h-24 bg-muted/30 rounded-lg border border-dashed flex items-center justify-center">
               <p className="text-sm text-muted-foreground">
                 Click the mic button below to test.
               </p>
               <VoiceInput
                 onVoiceData={handleTestVoiceData}
                 className="absolute bottom-2 right-2"
               />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Voice Commands Used
            </CardTitle>
            <Mic className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.voiceCommandsUsed}</div>
            <p className="text-xs text-muted-foreground">
              Total attempts to use voice input
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Successful Parses
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successfulParses}</div>
            <p className="text-xs text-muted-foreground">
              Transactions added via voice
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Processing Time
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.averageProcessingTime / 1000).toFixed(2)}s
            </div>
            <p className="text-xs text-muted-foreground">
              Average time to process voice input
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Voice Usage Summary</CardTitle>
          <CardDescription>
            Your interaction with the voice assistant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You've added <span className="font-medium text-foreground">{stats.successfulParses}</span> transactions by voice.
            {stats.successfulParses > 0 && stats.successfulParses < 5 && " Keep going to unlock the full potential!"}
            {stats.successfulParses >= 5 && " You're a voice power user!"}
            {stats.successfulParses === 0 && " Try adding your first transaction using voice commands on the Transactions page."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
