"use client";

import { useState, useMemo } from 'react';
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useTransactions, useBudgets } from '@/hooks/use-firestore-data';
import { useAuth } from '@/contexts/auth-context';
import { 
  generateTrendAnalysis, 
  generateSpendingInsights, 
  generateFinancialForecast, 
  generateComparativeAnalysis,
  formatCurrency,
  formatPercentage,
  type TrendAnalysis,
  type SpendingInsights,
  type FinancialForecast,
  type ComparativeAnalysis
} from '@/lib/analytics-utils';
import { detectSpendingAnomalies, detectSimpleAlerts } from '@/lib/anomaly-detection';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Target,
  ArrowUp,
  ArrowDown,
  Equal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap
} from "lucide-react";
import { cn } from '@/lib/utils';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { transactions, loading: transactionsLoading } = useTransactions();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { budgets } = useBudgets(currentMonth);
  
  const [timeRange, setTimeRange] = useState<string>('6'); // months back

  // Generate analytics data
  const analytics = useMemo(() => {
    if (transactions.length === 0) return null;

    const monthsBack = parseInt(timeRange);
    const trendAnalysis = generateTrendAnalysis(transactions, monthsBack);
    const spendingInsights = generateSpendingInsights(transactions);
    const forecast = generateFinancialForecast(trendAnalysis);
    const comparative = generateComparativeAnalysis(transactions, budgets, currentMonth);
    const anomalyReport = detectSpendingAnomalies(transactions, currentMonth);
    const simpleAlerts = detectSimpleAlerts(transactions, currentMonth);

    return {
      trend: trendAnalysis,
      spending: spendingInsights,
      forecast,
      comparative,
      anomalies: anomalyReport,
      alerts: simpleAlerts,
    };
  }, [transactions, budgets, timeRange, currentMonth]);

  const getTrendIcon = (value: number) => {
    if (value > 5) return <ArrowUp className="h-4 w-4 text-emerald-500" />;
    if (value < -5) return <ArrowDown className="h-4 w-4 text-red-500" />;
    return <Equal className="h-4 w-4 text-muted-foreground" />;
  };

  const getConfidenceColor = (confidence: 'low' | 'medium' | 'high') => {
    switch (confidence) {
      case 'high': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'low': return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const CHART_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'];

  if (transactionsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Loading your financial insights..." />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics || transactions.length === 0) {
    return (
      <>
        <PageHeader title="Analytics" description="Advanced financial insights and trends." />
        <Card className="text-center py-10">
          <CardHeader>
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle>No Data Available</CardTitle>
            <CardDescription>
              Add some transactions to see detailed analytics and insights about your financial patterns.
            </CardDescription>
          </CardHeader>
        </Card>
      </>
    );
  }

  const { trend, spending, forecast, comparative, anomalies, alerts } = analytics;

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

  return (
    <>
      <PageHeader
        title="Financial Analytics"
        description="Advanced insights, trends, and forecasts based on your financial data."
        actions={
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Months</SelectItem>
                <SelectItem value="6">6 Months</SelectItem>
                <SelectItem value="12">12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Money In Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getTrendIcon(trend.incomeGrowth)}
              <span className="text-2xl font-bold">{formatPercentage(trend.incomeGrowth)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last {timeRange} months</p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Expense Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getTrendIcon(trend.expenseGrowth)}
              <span className="text-2xl font-bold">{formatPercentage(trend.expenseGrowth)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last {timeRange} months</p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(trend.bestMonth.net)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{trend.bestMonth.monthLabel}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Forecast Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={cn("capitalize", getConfidenceColor(forecast.confidence))}>
              {forecast.confidence}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Based on {trend.monthlyData.length} months</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="spending">Spending</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
        </TabsList>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Monthly Trend Chart */}
            <Card className="shadow-md lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Monthly Money In vs Expenses
                </CardTitle>
                <CardDescription>Track your financial performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend.monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="monthLabel" 
                        stroke="hsl(var(--foreground))" 
                        fontSize={12}
                        tick={{ dy: 5 }}
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
                          name === 'income' ? 'Money In' : name === 'expenses' ? 'Expenses' : 'Net'
                        ]}
                      />
                      <Legend />
                                              <Bar dataKey="income" fill="#10b981" name="Money In" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Net Worth Trend */}
            <Card className="shadow-md lg:col-span-2">
              <CardHeader>
                <CardTitle>Net Financial Flow</CardTitle>
                <CardDescription>Your money in minus expenses over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend.monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="monthLabel" 
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
                        formatter={(value: number) => [formatCurrency(value), "Net Flow"]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="net" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Spending Tab */}
        <TabsContent value="spending" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Category Breakdown Pie Chart */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Spending by Category
                </CardTitle>
                <CardDescription>Where your money goes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={spending.topCategories.slice(0, 6)}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="amount"
                        label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                        labelLine={false}
                        fontSize={10}
                      >
                        {spending.topCategories.slice(0, 6).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top Categories */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Top Spending Categories</CardTitle>
                <CardDescription>Your highest expense categories</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {spending.topCategories.slice(0, 5).map((category, index) => (
                  <div key={category.category} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{category.category}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold">{formatCurrency(category.amount)}</span>
                        <span className="text-xs text-muted-foreground ml-2">({category.percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <Progress value={category.percentage} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      {category.transactions} transactions • Avg {formatCurrency(category.avgTransactionAmount)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Spending Insights */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Spending Insights</CardTitle>
              <CardDescription>Key observations about your spending patterns</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{spending.categoryCount}</div>
                <div className="text-sm text-muted-foreground">Active Categories</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{formatCurrency(spending.avgCategorySpending)}</div>
                <div className="text-sm text-muted-foreground">Avg per Category</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{formatCurrency(spending.uncategorizedSpending)}</div>
                <div className="text-sm text-muted-foreground">Uncategorized</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Next Month Forecast */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Next Month Forecast
                </CardTitle>
                <CardDescription>
                  Predicted financial performance 
                  <Badge className={cn("ml-2 capitalize", getConfidenceColor(forecast.confidence))}>
                    {forecast.confidence} confidence
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <span className="text-sm font-medium">Expected Income</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(forecast.nextMonthIncome)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <span className="text-sm font-medium">Expected Expenses</span>
                  <span className="font-bold text-red-600">{formatCurrency(forecast.nextMonthExpenses)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                  <span className="text-sm font-medium">Expected Net</span>
                  <span className={cn(
                    "font-bold",
                    forecast.nextMonthNet >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {formatCurrency(Math.abs(forecast.nextMonthNet))}
                    <span className="text-xs ml-1">
                      {forecast.nextMonthNet >= 0 ? "surplus" : "deficit"}
                    </span>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Year-end Projection */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Year-end Projection</CardTitle>
                <CardDescription>Estimated annual financial performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Projected Annual Income</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(forecast.yearEndProjection.totalIncome)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Projected Annual Expenses</span>
                  <span className="font-bold text-red-600">{formatCurrency(forecast.yearEndProjection.totalExpenses)}</span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Projected Annual Net</span>
                    <span className={cn(
                      "font-bold text-lg",
                      forecast.yearEndProjection.totalNet >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {formatCurrency(Math.abs(forecast.yearEndProjection.totalNet))}
                      <span className="text-sm ml-1">
                        {forecast.yearEndProjection.totalNet >= 0 ? "savings" : "deficit"}
                      </span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Forecast Methodology */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Forecast Methodology</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Forecasts use weighted averages with more emphasis on recent months</p>
              <p>• Confidence levels are based on data consistency and historical variance</p>
              <p>• High confidence: stable patterns over 6+ months with low variance</p>
              <p>• Medium confidence: moderate stability or limited data</p>
              <p>• Low confidence: high variance or insufficient historical data</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Month-over-Month Comparison */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Month-over-Month Changes</CardTitle>
                <CardDescription>{comparative.currentVsPrevious.period} comparison</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">Money In Change</span>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(comparative.currentVsPrevious.incomeChange)}
                    <span className="font-bold">{formatPercentage(comparative.currentVsPrevious.incomeChange)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">Expense Change</span>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(comparative.currentVsPrevious.expenseChange)}
                    <span className="font-bold">{formatPercentage(comparative.currentVsPrevious.expenseChange)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10">
                  <span className="text-sm font-medium">Net Change</span>
                  <span className={cn(
                    "font-bold",
                    comparative.currentVsPrevious.netChange >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {comparative.currentVsPrevious.netChange >= 0 ? '+' : ''}{formatCurrency(comparative.currentVsPrevious.netChange)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Budget Performance */}
            {comparative.budgetPerformance && (
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Budget Performance
                  </CardTitle>
                  <CardDescription>How you're doing against your budgets</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <div className="text-xl font-bold text-emerald-600">
                        {comparative.budgetPerformance.categoriesOnTrack}
                      </div>
                      <div className="text-xs text-muted-foreground">On Track</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="text-xl font-bold text-red-600">
                        {comparative.budgetPerformance.categoriesOverBudget}
                      </div>
                      <div className="text-xs text-muted-foreground">Over Budget</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Overall Budget Utilization</span>
                      <span className="font-medium">
                        {comparative.budgetPerformance.totalBudgetUtilization.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(comparative.budgetPerformance.totalBudgetUtilization, 100)} 
                      className={cn(
                        "h-3",
                        comparative.budgetPerformance.totalBudgetUtilization > 100 && "[&>div]:bg-destructive"
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Anomaly Detection Overview */}
            <Card className={cn("shadow-md lg:col-span-2", anomalies && getAssessmentColor(anomalies.overallAssessment))}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Anomaly Detection Report
                </CardTitle>
                <CardDescription>AI-powered spending pattern analysis for {new Date(currentMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</CardDescription>
              </CardHeader>
              <CardContent>
                {anomalies && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{anomalies.summary.totalAnomalies}</div>
                      <div className="text-sm text-muted-foreground">Anomalies</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{anomalies.summary.highSeverityCount}</div>
                      <div className="text-sm text-muted-foreground">High Severity</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{anomalies.summary.moderateSeverityCount}</div>
                      <div className="text-sm text-muted-foreground">Moderate</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{formatCurrency(anomalies.summary.totalExcessSpending)}</div>
                      <div className="text-sm text-muted-foreground">Excess Spending</div>
                    </div>
                  </div>
                )}
                
                <div className="text-center">
                  <Badge className={cn(
                    "text-lg px-4 py-2 capitalize",
                    anomalies && anomalies.overallAssessment === 'normal' && "bg-emerald-100 text-emerald-700 border-emerald-200",
                    anomalies && anomalies.overallAssessment === 'caution' && "bg-orange-100 text-orange-700 border-orange-200",
                    anomalies && anomalies.overallAssessment === 'alert' && "bg-red-100 text-red-700 border-red-200"
                  )}>
                    {anomalies?.overallAssessment || 'normal'} Status
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Detected Anomalies */}
            <Card className="shadow-md lg:col-span-2">
              <CardHeader>
                <CardTitle>Detected Anomalies</CardTitle>
                <CardDescription>Categories with unusual spending patterns</CardDescription>
              </CardHeader>
              <CardContent>
                {!anomalies || anomalies.anomalies.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
                    <p className="text-emerald-600 font-medium">No Anomalies Detected</p>
                    <p className="text-sm text-muted-foreground">Your spending patterns are within normal ranges</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {anomalies.anomalies.map((anomaly, index) => (
                      <Card key={index} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-lg">{anomaly.category}</span>
                              <Badge className={cn("text-xs", getSeverityColor(anomaly.severity))}>
                                {anomaly.severity}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-semibold text-red-600">
                                {formatCurrency(anomaly.currentAmount)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                vs avg {formatCurrency(anomaly.historicalAverage)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            <p>{anomaly.description}</p>
                          </div>
                          
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              {anomaly.recommendation}
                            </AlertDescription>
                          </Alert>
                          
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="text-muted-foreground">Z-Score:</span>
                              <span className="ml-1 font-medium">{anomaly.zScore.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Data Points:</span>
                              <span className="ml-1 font-medium">{anomaly.historicalData.monthsAnalyzed} months</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Trend:</span>
                              <span className="ml-1 font-medium capitalize">{anomaly.historicalData.recentTrend}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Simple Alerts */}
          {alerts && (alerts.largeTransactions.length > 0 || alerts.highDailySpending.length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Large Transactions */}
              {alerts.largeTransactions.length > 0 && (
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-orange-500" />
                      Large Transactions
                    </CardTitle>
                    <CardDescription>Transactions above ₹10,000</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {alerts.largeTransactions.slice(0, 5).map((transaction, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{transaction.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-IN')} • {transaction.category || 'Uncategorized'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-orange-600">{formatCurrency(transaction.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* High Daily Spending */}
              {alerts.highDailySpending.length > 0 && (
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-orange-500" />
                      High Daily Spending
                    </CardTitle>
                    <CardDescription>Days with spending above ₹5,000</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {alerts.highDailySpending.slice(0, 5).map((dailySpend, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">
                            {new Date(dailySpend.date + 'T00:00:00').toLocaleDateString('en-IN', { 
                              weekday: 'short', 
                              day: '2-digit', 
                              month: 'short' 
                            })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {dailySpend.transactions} transaction{dailySpend.transactions !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-orange-600">{formatCurrency(dailySpend.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
} 