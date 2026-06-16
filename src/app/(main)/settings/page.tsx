"use client";

import { useEffect, useState } from 'react';
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Activity, Clock } from "lucide-react";
import { getVoiceStats, VoiceStats } from '@/lib/voice-tracking';

export default function SettingsPage() {
  const [stats, setStats] = useState<VoiceStats>({
    voiceCommandsUsed: 0,
    successfulParses: 0,
    averageProcessingTime: 0,
  });

  useEffect(() => {
    setStats(getVoiceStats());
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="App preferences & usage statistics." />

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
