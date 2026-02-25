"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { FinancialHealthWidget } from "@/components/financial-health-widget";
import { BillsCalendarWidget } from "@/components/bills-calendar-widget";

import { DollarSign, TrendingUp, TrendingDown, Landmark, PieChart, CreditCard, Wallet, AlertTriangle, Repeat, Mic, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import type { Transaction } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTransactions, useBudgetSummary, useRecurringTransactions } from '@/hooks/use-firestore-data';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { getVoiceStats } from '@/lib/voice-tracking';

interface SpendingDataItem {
  name: string;
  value: number;
}

export default function DashboardPage() {
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [netWorth, setNetWorth] = useState(0); 
  const [financialHealthScore, setFinancialHealthScore] = useState(0);
  const [showVoiceTip, setShowVoiceTip] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { transactions, loading: transactionsLoading, refreshTransactions } = useTransactions();
  const { recurringTransactions, processRecurringTransactionsNow } = useRecurringTransactions();
  
  // Get current month for budget data
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { summary: budgetSummary, loading: budgetLoading } = useBudgetSummary(currentMonth);

  // Check for due recurring transactions
  const dueRecurringTransactions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return recurringTransactions.filter(rt => rt.isActive && rt.nextDueDate <= today);
  }, [recurringTransactions]);

  // Check voice stats for onboarding tip
  useEffect(() => {
    const stats = getVoiceStats();
    if (stats.voiceCommandsUsed === 0) {
      setShowVoiceTip(true);
    }
  }, []);

  // Auto-process recurring transactions on dashboard load
  useEffect(() => {
    if (user?.uid && dueRecurringTransactions.length > 0) {
      // Auto-process after a short delay to let the dashboard load first
      const timer = setTimeout(async () => {
        try {
          const processedCount = await processRecurringTransactionsNow();
          if (processedCount > 0) {
            refreshTransactions(); // Refresh transactions to show new ones
            toast({
              title: "Recurring Transactions Processed",
              description: `${processedCount} new transaction${processedCount !== 1 ? 's' : ''} created automatically.`,
            });
          }
        } catch (error) {
          console.error("Error auto-processing recurring transactions:", error);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user?.uid, dueRecurringTransactions.length, processRecurringTransactionsNow, refreshTransactions, toast]);

  useEffect(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    setTotalIncome(income);
    setTotalExpenses(expenses);
  }, [transactions]);

  const spendingData: SpendingDataItem[] = useMemo(() => {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    if (expenseTransactions.length === 0) {
      return [];
    }

    const spendingByCategory: Record<string, number> = expenseTransactions.reduce((acc, curr) => {
      const category = curr.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(spendingByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Sort by value descending
  }, [transactions]);

  useEffect(() => {
    let score = 0;
    if (totalIncome > 0) {
      const savingsRatio = (totalIncome - totalExpenses) / totalIncome;
      if (savingsRatio >= 0.2) score += 50;
      else if (savingsRatio > 0) score += (savingsRatio / 0.2) * 50;
    } else if (totalIncome === 0 && totalExpenses > 0) {
      score = 5;
    }

    // Add basic score based on income vs expenses
    if (totalIncome > totalExpenses) score += 50;
    
    setFinancialHealthScore(Math.max(0, Math.min(Math.round(score), 100)));
  }, [totalIncome, totalExpenses]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const isLoading = transactionsLoading;

  return (
    <>
      <PageHeader title="Dashboard" description="Your financial overview at a glance." />
      
      {/* Voice Onboarding Tip */}
      {showVoiceTip && (
        <Alert className="mb-6 border-purple-500 bg-purple-50 dark:bg-purple-900/20 relative">
          <Mic className="h-4 w-4 text-purple-600" />
          <AlertDescription className="text-purple-800 dark:text-purple-200 pr-8">
            <strong>Try Voice Input!</strong> Adding transactions is faster with voice.
            Go to <Link href="/transactions" className="underline font-medium">Transactions</Link> and click the microphone icon.
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 text-purple-600 hover:text-purple-800 hover:bg-purple-100"
            onClick={() => setShowVoiceTip(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Alert>
      )}

      {/* Bills Due Alert */}
      {dueRecurringTransactions.length > 0 && (
        <Alert className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
          <Repeat className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>{dueRecurringTransactions.length} bill{dueRecurringTransactions.length !== 1 ? 's are' : ' is'} due</strong> today ({formatCurrency(dueRecurringTransactions.reduce((sum, rt) => sum + rt.amount, 0))}).{' '}
            <Link href="/bills" className="underline font-medium">View bill calendar</Link> or{' '}
            <Link href="/recurring" className="underline font-medium">manage recurring transactions</Link>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Budget Alert */}
      {budgetSummary && budgetSummary.categoriesOverBudget > 0 && (
        <Alert className="mb-6 border-orange-500 bg-orange-50 dark:bg-orange-900/20">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <strong>Budget Alert:</strong> You're over budget in {budgetSummary.categoriesOverBudget} categor{budgetSummary.categoriesOverBudget > 1 ? 'ies' : 'y'} this month.{' '}
            <Link href="/budgets" className="underline font-medium">View details</Link>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Stats Cards - Responsive Grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total Money In" value={formatCurrency(totalIncome)} icon={TrendingUp} trendColor="text-emerald-500" />
        <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={TrendingDown} trendColor="text-red-500"/>
                  <StatCard title="Net Balance" value={formatCurrency(totalIncome - totalExpenses)} icon={DollarSign} description="Money In - Expenses" />
        {budgetSummary ? (
          <StatCard 
            title="Budget Status" 
            value={formatCurrency(Math.abs(budgetSummary.totalRemaining))} 
            icon={Wallet} 
            description={budgetSummary.totalRemaining >= 0 ? "Under budget" : "Over budget"}
            trendColor={budgetSummary.totalRemaining >= 0 ? "text-emerald-500" : "text-red-500"}
          />
        ) : (
          <StatCard title="Net Worth" value={formatCurrency(netWorth)} icon={Landmark} description="Estimated (coming soon)" />
        )}
      </div>

      {/* Main Content - Responsive Grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3 mb-6">
        {/* Spending Overview */}
        <Card className="shadow-md lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">Spending Overview</CardTitle>
                <CardDescription className="text-sm">
                  {spendingData.length > 0 ? "Your expenses by category this month (₹)." : "No spending data available yet."}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild className="text-xs">
                <Link href="/analytics">View Analytics</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-[250px] sm:h-[300px]">
            {spendingData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendingData} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number" 
                    stroke="hsl(var(--foreground))" 
                    fontSize={10} 
                    tickFormatter={(value) => `₹${value/1000}k`} 
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke="hsl(var(--foreground))" 
                    fontSize={9}
                    width={60}
                    tick={{ dy: 5 }} 
                    tickFormatter={(value) => value.length > 8 ? `${value.slice(0, 8)}...` : value}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))', 
                      borderRadius: 'var(--radius)',
                      fontSize: '12px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [formatCurrency(value), "Spending"]}
                  />
                  <Legend wrapperStyle={{fontSize: "10px", paddingTop: "5px"}}/>
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Spending" barSize={15}/>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <PieChart className="h-8 w-8 sm:h-12 sm:w-12 mb-2" />
                <p className="text-sm">No expenses recorded yet.</p>
                <p className="text-xs">Add an expense transaction to see your spending breakdown.</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Budget Overview or Financial Health Widget */}
        {budgetSummary && budgetSummary.totalBudget > 0 ? (
          <Card className="shadow-md lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg">This Month's Budget</CardTitle>
                <Button variant="outline" size="sm" asChild className="text-xs">
                  <Link href="/budgets">View All</Link>
                </Button>
              </div>
              <CardDescription className="text-sm">Track your spending against your budget.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 h-[250px] sm:h-[300px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Budgeted</p>
                  <p className="text-lg font-semibold text-primary">{formatCurrency(budgetSummary.totalBudget)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Spent</p>
                  <p className="text-lg font-semibold text-red-600">{formatCurrency(budgetSummary.totalSpent)}</p>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {budgetSummary.totalBudget > 0 ? ((budgetSummary.totalSpent / budgetSummary.totalBudget) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <Progress 
                  value={budgetSummary.totalBudget > 0 ? Math.min((budgetSummary.totalSpent / budgetSummary.totalBudget) * 100, 100) : 0} 
                  className={cn(
                    "h-3",
                    budgetSummary.totalSpent > budgetSummary.totalBudget && "[&>div]:bg-destructive"
                  )}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className={cn(
                    "font-medium",
                    budgetSummary.totalRemaining >= 0 ? "text-emerald-600" : "text-destructive"
                  )}>
                    {budgetSummary.totalRemaining >= 0 ? formatCurrency(budgetSummary.totalRemaining) : `-${formatCurrency(Math.abs(budgetSummary.totalRemaining))}`}
                  </span>
                </div>
                
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{budgetSummary.categoriesOnTrack} categories on track</span>
                    <span>{budgetSummary.categoriesOverBudget} over budget</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <FinancialHealthWidget score={financialHealthScore} />
        )}

        {/* Bills Calendar Widget */}
        <BillsCalendarWidget />
      </div>
      
      {/* Recent Transactions */}
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base sm:text-lg">Recent Transactions</CardTitle>
              <CardDescription className="text-sm">Your latest financial activities.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild className="text-xs shrink-0">
              <Link href="/transactions">View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3 p-4">
            {transactions.length === 0 ? (
              <div className="py-8 text-center">
                <CreditCard className="h-8 w-8 mb-2 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground text-sm">No transactions recorded yet.</p>
                <Link href="/transactions" className="text-primary hover:underline text-xs mt-1 block">Add your first transaction</Link>
              </div>
            ) : (
              transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}
                      </p>
                    </div>
                    <div className={`text-right ${transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      <p className="font-semibold text-sm">
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </p>
                    </div>
                  </div>
                  {transaction.category && (
                    <div>
                      <span className="text-xs bg-muted px-2 py-1 rounded">{transaction.category}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              {transactions.length === 0 && (
                   <TableCaption className="py-10 text-center">
                      <div className="flex flex-col items-center justify-center">
                          <CreditCard className="h-12 w-12 mb-2 text-muted-foreground" />
                          <p className="text-muted-foreground">No transactions recorded yet.</p>
                          <Link href="/transactions" className="text-primary hover:underline text-sm mt-1">Add your first transaction</Link>
                      </div>
                   </TableCaption>
              )}
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Description</TableHead>
                  <TableHead className="min-w-[100px]">Category</TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 5).map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.description}</TableCell>
                    <TableCell>{transaction.category || <span className="italic text-muted-foreground">N/A</span>}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(transaction.date  + 'T00:00:00').toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}</TableCell>
                    <TableCell className={`text-right font-semibold whitespace-nowrap ${transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
