"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from "@/components/page-header";
import { AddBudgetDialog } from "@/components/add-budget-dialog";
// import { SmartBudgetDialog } from "@/components/smart-budget-dialog"; // Disabled for now
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Budget } from "@/lib/types";
import { deleteBudget, updateBudgetSpending } from '@/services/budgets';
import { useToast } from "@/hooks/use-toast";
import { Target, AlertTriangle, TrendingUp, Calendar, Edit, Trash2, RefreshCw, Sparkles, Brain } from "lucide-react";
import { useBudgets, useBudgetSummary, useTransactions } from '@/hooks/use-firestore-data';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
// Temporarily disabled budget recommendations due to Genkit Node.js module conflicts
// import { BudgetRecommendations } from '@/components/budget-recommendations';

export default function BudgetsPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Generate current month as default
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const { budgets, loading, error, refreshBudgets, updateBudgetsWithSpending } = useBudgets(selectedMonth);
  const { summary, loading: summaryLoading, refreshSummary } = useBudgetSummary(selectedMonth);
  const { transactions } = useTransactions();

  // Generate month options
  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    // Previous 3 months + current month + next 11 months
    for (let i = -3; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = date.toISOString().slice(0, 7);
      const displayStr = date.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long' 
      });
      options.push({ value: monthStr, label: displayStr });
    }
    
    return options;
  };

  const monthOptions = generateMonthOptions();

  const handleBudgetAdded = (newBudget: Budget) => {
    refreshBudgets();
    refreshSummary();
    toast({ title: "Budget Created", description: `Budget for '${newBudget.category}' has been set.`});
  };

  const handleSmartBudgetsCreated = (budgets: Budget[]) => {
    refreshBudgets();
    refreshSummary();
    // Toast is handled in the SmartBudgetDialog component
  };

  const handleDeleteBudget = async (budgetId: string, category: string) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }
    try {
      await deleteBudget(user.uid, budgetId);
      refreshBudgets();
      refreshSummary();
      toast({ title: "Success", description: `Budget for ${category} deleted.` });
    } catch (error) {
      console.error("Error deleting budget:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete budget." });
    }
  };

  const handleRefreshSpending = async () => {
    try {
      await updateBudgetsWithSpending(selectedMonth);
      refreshSummary();
      toast({ title: "Updated", description: "Budget spending amounts refreshed." });
    } catch (error) {
      console.error("Error refreshing spending:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to refresh spending data." });
    }
  };

  // Budget recommendations temporarily disabled due to Genkit Node.js module conflicts

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getBudgetStatus = (budget: Budget) => {
    const percentage = budget.budgetAmount > 0 ? (budget.spentAmount / budget.budgetAmount) * 100 : 0;
    
    if (percentage >= 100) return { status: 'over', color: 'destructive', icon: AlertTriangle };
    if (percentage >= 80) return { status: 'warning', color: 'warning', icon: AlertTriangle };
    if (percentage >= 50) return { status: 'moderate', color: 'default', icon: TrendingUp };
    return { status: 'good', color: 'success', icon: Target };
  };

  const overBudgetCategories = budgets.filter(budget => budget.spentAmount > budget.budgetAmount);

  return (
    <>
      <PageHeader
        title="Budget Tracker"
        description="Set spending limits and track your progress to stay on top of your finances."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshSpending} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Sync Spending
            </Button>
            {/* Temporarily disabled due to Genkit Node.js module conflicts
            <Button variant="outline" size="sm" onClick={handleGenerateRecommendations} className="gap-2">
              <Brain className="h-4 w-4" />
              AI Recommendations
            </Button>
            */}
            <AddBudgetDialog onBudgetAdded={handleBudgetAdded} defaultMonth={selectedMonth} />
          </div>
        }
      />

      {/* Month Selector */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Viewing budgets for:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Alerts for over-budget categories */}
      {overBudgetCategories.length > 0 && (
        <Alert className="mb-6 border-destructive bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">
            <strong>Budget Alert:</strong> You&apos;ve exceeded your budget in {overBudgetCategories.length} categor{overBudgetCategories.length > 1 ? 'ies' : 'y'}: {' '}
            {overBudgetCategories.map(b => b.category).join(', ')}.
          </AlertDescription>
        </Alert>
      )}

      {/* Budget Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card className="shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(summary.totalBudget)}</div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalSpent)}</div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                summary.totalRemaining >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {formatCurrency(Math.abs(summary.totalRemaining))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.totalRemaining >= 0 ? "Under budget" : "Over budget"}
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Categories Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-600 font-medium">{summary.categoriesOnTrack} on track</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-red-600 font-medium">{summary.categoriesOverBudget} over</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Budget Recommendations - Temporarily disabled due to Genkit Node.js module conflicts
      <div className="mb-6">
        <BudgetRecommendations
          data={recommendationsData}
          isLoading={isGeneratingRecommendations}
          onGenerateRecommendations={handleGenerateRecommendations}
        />
      </div>
      */}

      {/* Budget List */}
      {budgets.length === 0 ? (
        <Card className="shadow-md text-center py-10">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Target className="mx-auto h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle>No Budgets Set</CardTitle>
            <CardDescription>
              Start managing your spending by creating your first budget for {monthOptions.find(m => m.value === selectedMonth)?.label}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddBudgetDialog onBudgetAdded={handleBudgetAdded} defaultMonth={selectedMonth} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const { status, color, icon: StatusIcon } = getBudgetStatus(budget);
            const percentage = budget.budgetAmount > 0 ? (budget.spentAmount / budget.budgetAmount) * 100 : 0;
            const remaining = budget.budgetAmount - budget.spentAmount;

            return (
              <Card key={budget.id} className={cn(
                "shadow-md transition-colors",
                status === 'over' && "border-destructive bg-destructive/5",
                status === 'warning' && "border-orange-500 bg-orange-50 dark:bg-orange-900/10"
              )}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <StatusIcon className={cn(
                          "h-5 w-5",
                          status === 'over' && "text-destructive",
                          status === 'warning' && "text-orange-500",
                          status === 'good' && "text-emerald-500"
                        )} />
                        {budget.category}
                      </CardTitle>
                      <CardDescription>
                        Budget: {formatCurrency(budget.budgetAmount)}
                      </CardDescription>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Budget: {budget.category}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this budget.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteBudget(budget.id, budget.category)} 
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">
                        Spent: {formatCurrency(budget.spentAmount)}
                      </span>
                      <Badge variant={
                        status === 'over' ? 'destructive' : 
                        status === 'warning' ? 'secondary' : 
                        'default'
                      }>
                        {percentage.toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress 
                      value={Math.min(percentage, 100)} 
                      className={cn(
                        "h-3",
                        status === 'over' && "[&>div]:bg-destructive",
                        status === 'warning' && "[&>div]:bg-orange-500"
                      )}
                    />
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Remaining:</span>
                      <span className={cn(
                        "font-medium",
                        remaining >= 0 ? "text-emerald-600" : "text-destructive"
                      )}>
                        {remaining >= 0 ? formatCurrency(remaining) : `-${formatCurrency(Math.abs(remaining))}`}
                      </span>
                    </div>
                    
                    {status === 'over' && (
                      <p className="text-xs text-destructive font-medium">
                        ⚠️ {formatCurrency(Math.abs(remaining))} over budget
                      </p>
                    )}
                    
                    {status === 'warning' && (
                      <p className="text-xs text-orange-600 font-medium">
                        ⚡ Approaching budget limit
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
} 