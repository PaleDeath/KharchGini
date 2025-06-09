
"use client";

import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2 } from "lucide-react";
import { getFinancialInsightsAction } from '@/actions/insights-actions';
import type { FinancialInsightsOutput } from '@/ai/flows/financial-insights';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

const insightsFormSchema = z.object({
  income: z.coerce.number().positive("Income must be a positive number (₹)."),
  expenses: z.coerce.number().positive("Expenses must be a positive number (₹)."),
  financialGoals: z.string().min(10, "Please describe your financial goals (min 10 characters)."),
  spendingPatterns: z.string().min(10, "Please describe your spending patterns (min 10 characters)."),
});

type InsightsFormValues = z.infer<typeof insightsFormSchema>;

export default function AiInsightsPage() {
  const [insights, setInsights] = useState<FinancialInsightsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsightsFormValues>({
    resolver: zodResolver(insightsFormSchema),
    defaultValues: {
      income: 50000, // Default INR amount
      expenses: 30000, // Default INR amount
      financialGoals: "Save for a down payment for a flat and invest for retirement.",
      spendingPatterns: "I tend to spend a lot on eating out and online shopping (Flipkart, Myntra). I also have a few subscriptions like Netflix and Hotstar.",
    },
  });

  const onSubmit = async (data: InsightsFormValues) => {
    setIsLoading(true);
    setInsights(null); 
    try {
      const result = await getFinancialInsightsAction(data);
      if (result.success && result.insights) {
        setInsights(result.insights);
        toast({ title: "Insights Generated", description: "Your personalized financial insights are ready." });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error || "Failed to generate insights." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI Financial Advisor"
        description="Get personalized financial insights and recommendations powered by AI."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Your Financial Profile</CardTitle>
            <CardDescription>Provide some details for the AI to analyze. All amounts in INR (₹).</CardDescription>
          </CardHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="income">Monthly Income (₹)</Label>
                <Input id="income" type="number" step="100" {...form.register("income")} placeholder="e.g., 60000" className={cn(form.formState.errors.income && "border-destructive")} />
                {form.formState.errors.income && <p className="text-xs text-destructive mt-1">{form.formState.errors.income.message}</p>}
              </div>
              <div>
                <Label htmlFor="expenses">Monthly Expenses (₹)</Label>
                <Input id="expenses" type="number" step="100" {...form.register("expenses")} placeholder="e.g., 35000" className={cn(form.formState.errors.expenses && "border-destructive")} />
                {form.formState.errors.expenses && <p className="text-xs text-destructive mt-1">{form.formState.errors.expenses.message}</p>}
              </div>
              <div>
                <Label htmlFor="financialGoals">Financial Goals</Label>
                <Textarea id="financialGoals" {...form.register("financialGoals")} placeholder="e.g., Save for a new car, pay off education loan, invest for children's education." className={cn(form.formState.errors.financialGoals && "border-destructive")} />
                {form.formState.errors.financialGoals && <p className="text-xs text-destructive mt-1">{form.formState.errors.financialGoals.message}</p>}
              </div>
              <div>
                <Label htmlFor="spendingPatterns">Spending Patterns</Label>
                <Textarea id="spendingPatterns" {...form.register("spendingPatterns")} placeholder="e.g., I spend most on rent, groceries, and travel. I try to save 20% of my income." className={cn(form.formState.errors.spendingPatterns && "border-destructive")} />
                {form.formState.errors.spendingPatterns && <p className="text-xs text-destructive mt-1">{form.formState.errors.spendingPatterns.message}</p>}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {isLoading ? "Generating Insights..." : "Get AI Insights"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Personalized Insights</CardTitle>
            <CardDescription>Here's what our AI financial advisor suggests for you.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-[300px]">
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Generating your insights...</p>
              </div>
            )}
            {!isLoading && !insights && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Wand2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Your financial insights will appear here once generated.</p>
                <p className="text-sm text-muted-foreground mt-1">Fill out the form and click "Get AI Insights".</p>
              </div>
            )}
            {insights && (
              <div className="prose prose-sm max-w-none dark:prose-invert text-foreground">
                <p>{insights.insights}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
