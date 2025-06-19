'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Eye, 
  RefreshCw,
  Calendar,
  DollarSign,
  Activity,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/lib/types';
import { detectSpendingAnomalies, detectSimpleAlerts, type AnomalyDetectionReport } from '@/lib/anomaly-detection';

interface AnomalyDetectionProps {
  transactions: Transaction[];
  selectedMonth?: string;
  className?: string;
}

export function AnomalyDetection({ transactions, selectedMonth, className }: AnomalyDetectionProps) {
  const [report, setReport] = useState<AnomalyDetectionReport | null>(null);
  const [simpleAlerts, setSimpleAlerts] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const currentMonth = selectedMonth || new Date().toISOString().slice(0, 7);

  useEffect(() => {
    analyzeAnomalies();
  }, [transactions, currentMonth]);

  const analyzeAnomalies = async () => {
    if (transactions.length === 0) return;

    setIsAnalyzing(true);
    try {
      // Run anomaly detection
      const anomalyReport = detectSpendingAnomalies(transactions, currentMonth, 6);
      const alerts = detectSimpleAlerts(transactions, currentMonth);
      
      setReport(anomalyReport);
      setSimpleAlerts(alerts);
    } catch (error) {
      console.error('Error analyzing anomalies:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'extreme': return 'destructive';
      case 'high': return 'destructive';
      case 'moderate': return 'secondary';
      default: return 'default';
    }
  };

  const getAssessmentColor = (assessment: string) => {
    switch (assessment) {
      case 'alert': return 'text-red-600 bg-red-50';
      case 'caution': return 'text-orange-600 bg-orange-50';
      case 'normal': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getAssessmentIcon = (assessment: string) => {
    switch (assessment) {
      case 'alert': return <AlertTriangle className="h-5 w-5" />;
      case 'caution': return <Eye className="h-5 w-5" />;
      case 'normal': return <Shield className="h-5 w-5" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  if (isAnalyzing) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <CardTitle>Analyzing Spending Patterns</CardTitle>
          <CardDescription>
            Detecting anomalies and unusual spending patterns...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Activity className="h-8 w-8 text-gray-600" />
          </div>
          <CardTitle>Anomaly Detection</CardTitle>
          <CardDescription>
            Not enough data to analyze spending patterns. Add more transactions to get insights.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={analyzeAnomalies} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Anomaly Detection
            </CardTitle>
            <CardDescription>
              Analysis for {new Date(currentMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </CardDescription>
          </div>
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg",
            getAssessmentColor(report.overallAssessment)
          )}>
            {getAssessmentIcon(report.overallAssessment)}
            <span className="font-medium capitalize">{report.overallAssessment}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium">Total Anomalies</span>
                  </div>
                  <div className="text-2xl font-bold">{report.summary.totalAnomalies}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">High Risk</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">{report.summary.highSeverityCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Excess Spending</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    ₹{report.summary.totalExcessSpending.toLocaleString('en-IN')}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Categories</span>
                  </div>
                  <div className="text-2xl font-bold">{report.summary.categoriesAffected}</div>
                </CardContent>
              </Card>
            </div>

            {/* Overall Assessment */}
            <Alert className={cn(
              "border-l-4",
              report.overallAssessment === 'alert' && "border-red-500 bg-red-50",
              report.overallAssessment === 'caution' && "border-orange-500 bg-orange-50",
              report.overallAssessment === 'normal' && "border-green-500 bg-green-50"
            )}>
              <div className="flex items-center gap-2">
                {getAssessmentIcon(report.overallAssessment)}
                <AlertDescription>
                  <strong>Overall Assessment: {report.overallAssessment.toUpperCase()}</strong>
                  <br />
                  {report.overallAssessment === 'alert' && 
                    "Multiple high-risk anomalies detected. Review your spending immediately."}
                  {report.overallAssessment === 'caution' && 
                    "Some unusual spending patterns detected. Monitor your expenses closely."}
                  {report.overallAssessment === 'normal' && 
                    "Your spending patterns appear normal for this month."}
                </AlertDescription>
              </div>
            </Alert>
          </TabsContent>

          <TabsContent value="anomalies" className="space-y-4">
            {report.anomalies.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-green-600 mb-2">No Anomalies Detected</h3>
                <p className="text-muted-foreground">Your spending patterns look normal this month.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {report.anomalies.map((anomaly, index) => (
                  <Card key={index} className={cn(
                    "border-l-4",
                    anomaly.severity === 'extreme' && "border-red-600",
                    anomaly.severity === 'high' && "border-red-500",
                    anomaly.severity === 'moderate' && "border-orange-500"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-lg">{anomaly.category}</h4>
                          <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                        </div>
                        <Badge variant={getSeverityColor(anomaly.severity)}>
                          {anomaly.severity}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <div className="text-sm text-muted-foreground">Current</div>
                          <div className="font-medium">₹{anomaly.currentAmount.toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Average</div>
                          <div className="font-medium">₹{anomaly.historicalAverage.toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Increase</div>
                          <div className="font-medium text-red-600">
                            +{((anomaly.zScore) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm">{anomaly.recommendation}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Trend: {anomaly.historicalData.recentTrend}</span>
                        <span>•</span>
                        <span>{anomaly.historicalData.monthsAnalyzed} months analyzed</span>
                        <span>•</span>
                        <span>Range: ₹{anomaly.historicalData.minSpending.toLocaleString('en-IN')} - ₹{anomaly.historicalData.maxSpending.toLocaleString('en-IN')}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {/* Large Transactions */}
            {simpleAlerts?.largeTransactions?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-red-600" />
                    Large Transactions
                  </CardTitle>
                  <CardDescription>
                    Transactions above ₹10,000 that require attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {simpleAlerts.largeTransactions.map((transaction: Transaction, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {transaction.category} • {new Date(transaction.date).toLocaleDateString('en-IN')}
                          </div>
                        </div>
                        <div className="text-lg font-bold text-red-600">
                          ₹{transaction.amount.toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* High Daily Spending */}
            {simpleAlerts?.highDailySpending?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-orange-600" />
                    High Daily Spending
                  </CardTitle>
                  <CardDescription>
                    Days with spending above ₹5,000
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {simpleAlerts.highDailySpending.map((day: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div>
                          <div className="font-medium">{new Date(day.date).toLocaleDateString('en-IN')}</div>
                          <div className="text-sm text-muted-foreground">
                            {day.transactions} transactions
                          </div>
                        </div>
                        <div className="text-lg font-bold text-orange-600">
                          ₹{day.amount.toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {(!simpleAlerts?.largeTransactions?.length && !simpleAlerts?.highDailySpending?.length) && (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-green-600 mb-2">No Alerts</h3>
                <p className="text-muted-foreground">No large transactions or high daily spending detected.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-6 pt-4 border-t">
          <Button onClick={analyzeAnomalies} variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Analysis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
