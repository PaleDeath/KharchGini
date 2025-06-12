"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTransactions } from '@/hooks/use-firestore-data';
import { detectSpendingAnomalies, detectSimpleAlerts, type AnomalyDetectionReport } from '@/lib/anomaly-detection';
import { AlertTriangle, TrendingUp, Shield, Eye, Zap } from "lucide-react";
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function AnomalyAlertsWidget() {
  const { transactions } = useTransactions();
  
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const anomalyReport = useMemo(() => {
    if (transactions.length === 0) return null;
    return detectSpendingAnomalies(transactions, currentMonth);
  }, [transactions, currentMonth]);

  const simpleAlerts = useMemo(() => {
    if (transactions.length === 0) return null;
    return detectSimpleAlerts(transactions, currentMonth);
  }, [transactions, currentMonth]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getSeverityColor = (severity: 'moderate' | 'high' | 'extreme') => {
    switch (severity) {
      case 'extreme': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'moderate': return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const getAssessmentColor = (assessment: 'normal' | 'caution' | 'alert') => {
    switch (assessment) {
      case 'alert': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'caution': return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'normal': return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
    }
  };

  const getAssessmentIcon = (assessment: 'normal' | 'caution' | 'alert') => {
    switch (assessment) {
      case 'alert': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'caution': return <Zap className="h-4 w-4 text-orange-600" />;
      case 'normal': return <Shield className="h-4 w-4 text-emerald-600" />;
    }
  };

  if (!anomalyReport && !simpleAlerts) {
    return (
      <Card className="shadow-md lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            Spending Alerts
          </CardTitle>
          <CardDescription>AI-powered anomaly detection</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[200px] text-center text-muted-foreground">
          <Shield className="h-8 w-8 mb-2 text-emerald-500" />
          <p className="text-sm">Add more transactions to enable anomaly detection</p>
        </CardContent>
      </Card>
    );
  }

  const hasActiveAlerts = (anomalyReport?.anomalies.length || 0) > 0 || 
                         (simpleAlerts?.largeTransactions.length || 0) > 0 ||
                         (simpleAlerts?.highDailySpending.length || 0) > 0;

  return (
    <Card className={cn(
      "shadow-md lg:col-span-1",
      anomalyReport && getAssessmentColor(anomalyReport.overallAssessment)
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {anomalyReport && getAssessmentIcon(anomalyReport.overallAssessment)}
              Spending Alerts
            </CardTitle>
            <CardDescription>
              {anomalyReport 
                ? `${anomalyReport.summary.totalAnomalies} anomal${anomalyReport.summary.totalAnomalies !== 1 ? 'ies' : 'y'} detected`
                : 'AI-powered anomaly detection'
              }
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild className="text-xs">
            <Link href="/analytics">
              <Eye className="h-3 w-3 mr-1" />
              Details
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 h-[200px] overflow-y-auto">
        {!hasActiveAlerts ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Shield className="h-8 w-8 mb-2 text-emerald-500" />
            <p className="text-sm text-emerald-600">All clear!</p>
            <p className="text-xs text-muted-foreground">No unusual spending detected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Anomaly Alerts */}
            {anomalyReport?.anomalies.slice(0, 3).map((anomaly, index) => (
              <Alert key={index} className="p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{anomaly.category}</span>
                      <Badge className={cn("text-xs", getSeverityColor(anomaly.severity))}>
                        {anomaly.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(anomaly.currentAmount)} vs avg {formatCurrency(anomaly.historicalAverage)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Z-score: {anomaly.zScore.toFixed(1)}
                    </p>
                  </div>
                </div>
              </Alert>
            ))}

            {/* Large Transaction Alerts */}
            {simpleAlerts?.largeTransactions.slice(0, 2).map((transaction, index) => (
              <Alert key={`large-${index}`} className="p-3">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Large Transaction</span>
                      <span className="text-sm font-semibold text-orange-600">
                        {formatCurrency(transaction.amount)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-IN', { 
                        day: '2-digit', 
                        month: 'short' 
                      })}
                    </p>
                  </div>
                </div>
              </Alert>
            ))}

            {/* High Daily Spending Alerts */}
            {simpleAlerts?.highDailySpending.slice(0, 1).map((dailySpend, index) => (
              <Alert key={`daily-${index}`} className="p-3">
                <div className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">High Daily Spending</span>
                      <span className="text-sm font-semibold text-orange-600">
                        {formatCurrency(dailySpend.amount)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(dailySpend.date + 'T00:00:00').toLocaleDateString('en-IN', { 
                        day: '2-digit', 
                        month: 'short' 
                      })} • {dailySpend.transactions} transactions
                    </p>
                  </div>
                </div>
              </Alert>
            ))}

            {/* Show more indicator */}
            {(anomalyReport?.summary.totalAnomalies || 0) > 3 && (
              <div className="text-center">
                <Button variant="ghost" size="sm" asChild className="text-xs">
                  <Link href="/analytics">
                    +{(anomalyReport?.summary.totalAnomalies || 0) - 3} more alerts
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 