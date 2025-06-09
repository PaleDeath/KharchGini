
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { FinancialHealthWidget } from "@/components/financial-health-widget";
import { DollarSign, TrendingUp, TrendingDown, Landmark, Target as TargetIcon, PieChart, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import type { Transaction, FinancialGoal } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SpendingDataItem {
  name: string;
  value: number;
}

export default function DashboardPage() {
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [netWorth, setNetWorth] = useState(0); 
  const [transactions, setTransactions] = useState<Transaction[]>([]); 
  const [goals, setGoals] = useState<FinancialGoal[]>([]); 
  const [financialHealthScore, setFinancialHealthScore] = useState(0);

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


    if (goals.length > 0) {
      const totalGoalProgress = goals.reduce((acc, goal) => {
        if (goal.targetAmount > 0 && goal.currentAmount > 0) { 
             return acc + (Math.min(goal.currentAmount, goal.targetAmount) / goal.targetAmount);
        }
        return acc;
      }, 0);
      const avgGoalProgress = totalGoalProgress / goals.length;
      score += Math.min(avgGoalProgress * 50, 50);
    } else {
      if (totalIncome > totalExpenses) score += 10;
    }
    setFinancialHealthScore(Math.max(0, Math.min(Math.round(score), 100)));
  }, [totalIncome, totalExpenses, goals]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <>
      <PageHeader title="Dashboard" description="Your financial overview at a glance." />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total Income" value={formatCurrency(totalIncome)} icon={TrendingUp} trendColor="text-emerald-500" />
        <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={TrendingDown} trendColor="text-red-500"/>
        <StatCard title="Net Balance" value={formatCurrency(totalIncome - totalExpenses)} icon={DollarSign} description="Income - Expenses" />
        <StatCard title="Net Worth" value={formatCurrency(netWorth)} icon={Landmark} description="Estimated (coming soon)" />
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3 mb-6">
        <Card className="shadow-md lg:col-span-1">
          <CardHeader>
            <CardTitle>Spending Overview</CardTitle>
            <CardDescription>
              {spendingData.length > 0 ? "Your expenses by category this month (₹)." : "No spending data available yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {spendingData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendingData} layout="vertical" margin={{ right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--foreground))" fontSize={12} tickFormatter={(value) => `₹${value/1000}k`} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--foreground))" fontSize={12} width={80} tick={{ dy: 5 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [formatCurrency(value), "Spending"]}
                  />
                  <Legend wrapperStyle={{fontSize: "12px", paddingTop: "10px"}}/>
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Spending" barSize={20}/>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <PieChart className="h-12 w-12 mb-2" />
                <p>No expenses recorded yet.</p>
                <p className="text-xs">Add an expense transaction to see your spending breakdown.</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <FinancialHealthWidget score={financialHealthScore} />

        <Card className="shadow-md lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Active Goals</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/goals">View All</Link>
              </Button>
            </div>
            <CardDescription>Track your progress towards financial goals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 h-[300px] overflow-y-auto">
            {goals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <TargetIcon className="h-12 w-12 mb-2" />
                <p>No active goals yet.</p>
                <Link href="/goals" className="text-primary hover:underline text-sm mt-1">Add a goal</Link>
              </div>
            ) : (
              goals.slice(0,3).map(goal => (
                <div key={goal.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-foreground">{goal.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>
                  <Progress value={(goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0)} className="h-2" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/transactions">View All</Link>
            </Button>
          </div>
          <CardDescription>Your latest financial activities.</CardDescription>
        </CardHeader>
        <CardContent>
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
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.slice(0, 5).map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">{transaction.description}</TableCell>
                  <TableCell>{transaction.category || <span className="italic text-muted-foreground">N/A</span>}</TableCell>
                  <TableCell>{new Date(transaction.date  + 'T00:00:00').toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}</TableCell>
                  <TableCell className={`text-right font-semibold ${transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

    