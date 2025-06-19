'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  Calendar, 
  DollarSign,
  Activity,
  RefreshCw,
  Eye,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/lib/types';
import { generateCashFlowPrediction, type CashFlowAnalysis } from '@/lib/cash-flow-prediction';

interface CashFlowPredictionProps {
  transactions: Transaction[];
  monthsAhead?: number;
  className?: string;
}

export function CashFlowPrediction({ transactions, monthsAhead = 6, className }: CashFlowPredictionProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedScenario, setSelectedScenario] = useState<'realistic' | 'optimistic' | 'pessimistic'>('realistic');

  const analysis = useMemo(() => {
    if (transactions.length === 0) return null;
    return generateCashFlowPrediction(transactions, monthsAhead);
  }, [transactions, monthsAhead]);

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600 bg-green-50';
      case 'declining': return 'text-red-600 bg-red-50';
      case 'stable': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-orange-600 bg-orange-50';
      case 'low': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${Math.abs(amount).toLocaleString('en-IN')}`;
  };

  if (!analysis) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle>Cash Flow Prediction</CardTitle>
          <CardDescription>
            Add more transactions to generate cash flow predictions and insights
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartData = analysis.scenarios[selectedScenario].map(pred => ({
    month: pred.monthLabel,
    income: pred.predictedIncome,
    expenses: pred.predictedExpenses,
    net: pred.predictedNet,
    confidence: pred.confidence
  }));

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Cash Flow Prediction
            </CardTitle>
            <CardDescription>
              {monthsAhead}-month financial forecast based on historical patterns
            </CardDescription>
          </div>
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg",
            getTrendColor(analysis.insights.trend)
          )}>
            {analysis.insights.trend === 'improving' && <TrendingUp className="h-4 w-4" />}
            {analysis.insights.trend === 'declining' && <TrendingDown className="h-4 w-4" />}
            {analysis.insights.trend === 'stable' && <Activity className="h-4 w-4" />}
            <span className="font-medium capitalize">{analysis.insights.trend}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="predictions">Predictions</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Current Balance</span>
                  </div>
                  <div className={cn(
                    "text-2xl font-bold",
                    analysis.currentBalance >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(analysis.currentBalance)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Avg Monthly Net</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(analysis.predictions.reduce((sum, p) => sum + p.predictedNet, 0) / analysis.predictions.length)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">Risk Level</span>
                  </div>
                  <Badge className={cn("capitalize", getRiskColor(analysis.insights.riskLevel))}>
                    {analysis.insights.riskLevel}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">High Confidence</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {analysis.predictions.filter(p => p.confidence === 'high').length}/{analysis.predictions.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Risk Assessment */}
            <Alert className={cn("border-l-4", getRiskColor(analysis.insights.riskLevel))}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Risk Assessment: {analysis.insights.riskLevel.toUpperCase()}</strong>
                  <br />
                  {analysis.insights.riskLevel === 'high' && 
                    "Multiple months show negative cash flow. Immediate action required."}
                  {analysis.insights.riskLevel === 'medium' && 
                    "Some months may have cash flow challenges. Monitor closely."}
                  {analysis.insights.riskLevel === 'low' && 
                    "Cash flow appears stable with minimal risk."}
                </AlertDescription>
              </div>
            </Alert>

            {/* Key Findings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key Findings</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.insights.keyFindings.map((finding, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-sm">{finding}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-4">
            {/* Prediction Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Cash Flow Forecast</CardTitle>
                <CardDescription>Predicted income, expenses, and net cash flow</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--foreground))" 
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--foreground))" 
                        fontSize={12}
                        tickFormatter={(value) => `₹${value/1000}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: 'var(--radius)',
                          fontSize: '12px'
                        }}
                        formatter={(value: number, name: string) => [
                          formatCurrency(value), 
                          name === 'income' ? 'Income' : name === 'expenses' ? 'Expenses' : 'Net'
                        ]}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="income" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="Income"
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="expenses" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        name="Expenses"
                        dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="net" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        name="Net Cash Flow"
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Breakdown */}
            <div className="space-y-3">
              {analysis.predictions.map((prediction, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{prediction.monthLabel}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={cn("text-xs", getConfidenceColor(prediction.confidence))}>
                            {prediction.confidence} confidence
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "text-lg font-bold",
                          prediction.predictedNet >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {prediction.predictedNet >= 0 ? '+' : '-'}{formatCurrency(prediction.predictedNet)}
                        </div>
                        <div className="text-sm text-muted-foreground">Net Cash Flow</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Income</div>
                        <div className="font-medium text-green-600">{formatCurrency(prediction.predictedIncome)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Expenses</div>
                        <div className="font-medium text-red-600">{formatCurrency(prediction.predictedExpenses)}</div>
                      </div>
                    </div>

                    {prediction.factors.length > 0 && (
                      <div className="border-t pt-3">
                        <div className="text-sm font-medium mb-2">Factors</div>
                        <div className="flex flex-wrap gap-1">
                          {prediction.factors.map((factor, factorIndex) => (
                            <Badge key={factorIndex} variant="outline" className="text-xs">
                              {factor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="scenarios" className="space-y-4">
            {/* Scenario Selector */}
            <div className="flex gap-2">
              <Button
                variant={selectedScenario === 'optimistic' ? 'default' : 'outline'}
                onClick={() => setSelectedScenario('optimistic')}
                className="flex-1"
              >
                Optimistic
              </Button>
              <Button
                variant={selectedScenario === 'realistic' ? 'default' : 'outline'}
                onClick={() => setSelectedScenario('realistic')}
                className="flex-1"
              >
                Realistic
              </Button>
              <Button
                variant={selectedScenario === 'pessimistic' ? 'default' : 'outline'}
                onClick={() => setSelectedScenario('pessimistic')}
                className="flex-1"
              >
                Pessimistic
              </Button>
            </div>

            {/* Scenario Comparison Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{selectedScenario.charAt(0).toUpperCase() + selectedScenario.slice(1)} Scenario</CardTitle>
                <CardDescription>
                  {selectedScenario === 'optimistic' && "Best case scenario with 15% higher income and 10% lower expenses"}
                  {selectedScenario === 'realistic' && "Most likely scenario based on historical patterns"}
                  {selectedScenario === 'pessimistic' && "Worst case scenario with 15% lower income and 10% higher expenses"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--foreground))" 
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--foreground))" 
                        fontSize={12}
                        tickFormatter={(value) => `₹${value/1000}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: 'var(--radius)'
                        }}
                        formatter={(value: number) => [formatCurrency(value), "Net Cash Flow"]}
                      />
                      <Bar 
                        dataKey="net" 
                        fill={selectedScenario === 'optimistic' ? '#10b981' : selectedScenario === 'pessimistic' ? '#ef4444' : '#3b82f6'}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysis.insights.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <Target className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Trend Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trend Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "p-4 rounded-lg border",
                  getTrendColor(analysis.insights.trend)
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    {analysis.insights.trend === 'improving' && <TrendingUp className="h-5 w-5" />}
                    {analysis.insights.trend === 'declining' && <TrendingDown className="h-5 w-5" />}
                    {analysis.insights.trend === 'stable' && <Activity className="h-5 w-5" />}
                    <span className="font-medium capitalize">{analysis.insights.trend} Trend</span>
                  </div>
                  <p className="text-sm">
                    {analysis.insights.trend === 'improving' && 
                      "Your cash flow is expected to improve over the forecast period. Continue current financial habits."}
                    {analysis.insights.trend === 'declining' && 
                      "Your cash flow shows a declining trend. Consider implementing cost-cutting measures."}
                    {analysis.insights.trend === 'stable' && 
                      "Your cash flow remains relatively stable. Focus on optimization opportunities."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
