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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Wand2, Target, TrendingUp, AlertTriangle, Lightbulb, Calendar } from "lucide-react";
import { getFinancialInsightsAction } from '@/actions/insights-actions';
import type { FinancialInsightsOutput } from '@/ai/flows/financial-insights';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

const insightsFormSchema = z.object({
  // Financial data
  income: z.coerce.number().positive("Money in must be a positive number (₹)."),
  expenses: z.coerce.number().positive("Expenses must be a positive number (₹)."),
  
  // Personal context
  userType: z.enum(['student', 'professional', 'freelancer', 'business_owner', 'retired', 'other'], {
    required_error: "Please select your situation."
  }),
  age: z.coerce.number().min(16, "Age must be at least 16").max(100, "Please enter a valid age"),
  dependents: z.coerce.number().min(0, "Dependents cannot be negative"),
  
  // Financial situation
  currentSavings: z.coerce.number().min(0, "Current savings cannot be negative"),
  monthlyFixedExpenses: z.coerce.number().min(0, "Fixed expenses cannot be negative"),
  
  // Goals and patterns
  financialGoals: z.string().min(10, "Please describe your financial goals (min 10 characters)."),
  spendingPatterns: z.string().min(10, "Please describe your spending patterns (min 10 characters)."),
  
  // Optional context
  location: z.enum(['metro', 'tier2', 'tier3', 'rural']).optional(),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
});

type InsightsFormValues = z.infer<typeof insightsFormSchema>;

export default function AiInsightsPage() {
  const [insights, setInsights] = useState<FinancialInsightsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsightsFormValues>({
    resolver: zodResolver(insightsFormSchema),
    defaultValues: {
      dependents: 0,
      currentSavings: 0,
      monthlyFixedExpenses: 0,
    }
  });

  const onSubmit = async (data: InsightsFormValues) => {
    setIsLoading(true);
    setInsights(null); 
    try {
      const result = await getFinancialInsightsAction(data);
      if (result.success && result.insights) {
        setInsights(result.insights);
        toast({ title: "AI Insights Generated", description: "Your personalized financial advice is ready!" });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error || "Failed to generate insights." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <>
      <PageHeader
        title="AI Financial Advisor"
        description="Get comprehensive, personalized financial insights and recommendations powered by AI."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Your Financial Profile</CardTitle>
            <CardDescription>Tell us about yourself for personalized advice. All amounts in INR (₹).</CardDescription>
          </CardHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              {/* Personal Context */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">Personal Context</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="userType">Your Situation</Label>
                    <Select onValueChange={(value) => form.setValue('userType', value as any)}>
                      <SelectTrigger className={cn(form.formState.errors.userType && "border-destructive")}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="professional">Working Professional</SelectItem>
                        <SelectItem value="freelancer">Freelancer</SelectItem>
                        <SelectItem value="business_owner">Business Owner</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.userType && <p className="text-xs text-destructive mt-1">{form.formState.errors.userType.message}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Input id="age" type="number" {...form.register("age")} placeholder="25" className={cn(form.formState.errors.age && "border-destructive")} />
                    {form.formState.errors.age && <p className="text-xs text-destructive mt-1">{form.formState.errors.age.message}</p>}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dependents">Dependents</Label>
                    <Input id="dependents" type="number" {...form.register("dependents")} placeholder="0" className={cn(form.formState.errors.dependents && "border-destructive")} />
                    {form.formState.errors.dependents && <p className="text-xs text-destructive mt-1">{form.formState.errors.dependents.message}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="location">Location Type (Optional)</Label>
                    <Select onValueChange={(value) => form.setValue('location', value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metro">Metro City</SelectItem>
                        <SelectItem value="tier2">Tier 2 City</SelectItem>
                        <SelectItem value="tier3">Tier 3 City</SelectItem>
                        <SelectItem value="rural">Rural Area</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Financial Data */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">Financial Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="income">Monthly Money In (₹)</Label>
                    <Input id="income" type="number" step="500" {...form.register("income")} placeholder="e.g., 50000" className={cn(form.formState.errors.income && "border-destructive")} />
                    {form.formState.errors.income && <p className="text-xs text-destructive mt-1">{form.formState.errors.income.message}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="expenses">Monthly Expenses (₹)</Label>
                    <Input id="expenses" type="number" step="500" {...form.register("expenses")} placeholder="e.g., 30000" className={cn(form.formState.errors.expenses && "border-destructive")} />
                    {form.formState.errors.expenses && <p className="text-xs text-destructive mt-1">{form.formState.errors.expenses.message}</p>}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="currentSavings">Current Savings (₹)</Label>
                    <Input id="currentSavings" type="number" step="1000" {...form.register("currentSavings")} placeholder="e.g., 100000" className={cn(form.formState.errors.currentSavings && "border-destructive")} />
                    {form.formState.errors.currentSavings && <p className="text-xs text-destructive mt-1">{form.formState.errors.currentSavings.message}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="monthlyFixedExpenses">Fixed Expenses (₹)</Label>
                    <Input id="monthlyFixedExpenses" type="number" step="500" {...form.register("monthlyFixedExpenses")} placeholder="e.g., 20000" className={cn(form.formState.errors.monthlyFixedExpenses && "border-destructive")} />
                    {form.formState.errors.monthlyFixedExpenses && <p className="text-xs text-destructive mt-1">{form.formState.errors.monthlyFixedExpenses.message}</p>}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="riskTolerance">Investment Risk Tolerance (Optional)</Label>
                  <Select onValueChange={(value) => form.setValue('riskTolerance', value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your comfort level..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative (Safety First)</SelectItem>
                      <SelectItem value="moderate">Moderate (Balanced)</SelectItem>
                      <SelectItem value="aggressive">Aggressive (High Growth)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Goals and Patterns */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">Goals & Patterns</h3>
                
                <div>
                  <Label htmlFor="financialGoals">Financial Goals</Label>
                  <Textarea 
                    id="financialGoals" 
                    {...form.register("financialGoals")} 
                    placeholder="e.g., Save for a bike in 6 months (₹80,000), build emergency fund of ₹2 lakhs, start investing for retirement..."
                    className={cn(form.formState.errors.financialGoals && "border-destructive")}
                    rows={3}
                  />
                  {form.formState.errors.financialGoals && <p className="text-xs text-destructive mt-1">{form.formState.errors.financialGoals.message}</p>}
                </div>
                
                <div>
                  <Label htmlFor="spendingPatterns">Spending Patterns</Label>
                  <Textarea 
                    id="spendingPatterns" 
                    {...form.register("spendingPatterns")} 
                    placeholder="e.g., I spend a lot on food delivery and subscriptions. My biggest expense is rent. I tend to buy things impulsively during sales..."
                    className={cn(form.formState.errors.spendingPatterns && "border-destructive")}
                    rows={3}
                  />
                  {form.formState.errors.spendingPatterns && <p className="text-xs text-destructive mt-1">{form.formState.errors.spendingPatterns.message}</p>}
                </div>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {isLoading ? "Analyzing Your Finances..." : "Get AI Financial Advice"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Enhanced Results Panel */}
        <Card className="shadow-md lg:col-span-1">
          <CardHeader>
            <CardTitle>Your Financial Advisory Report</CardTitle>
            <CardDescription>Comprehensive analysis and personalized recommendations</CardDescription>
          </CardHeader>
          <CardContent className="min-h-[600px]">
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Analyzing your financial profile...</p>
                <p className="text-sm text-muted-foreground mt-1">Creating personalized recommendations</p>
              </div>
            )}
            
            {!isLoading && !insights && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Wand2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Your comprehensive financial analysis will appear here</p>
                <p className="text-sm text-muted-foreground mt-1">Fill out the form and get personalized advice</p>
              </div>
            )}
            
            {insights && (
              <div className="space-y-6 text-sm">
                {/* Personalized Greeting & Health Score */}
                <div className="space-y-4">
                  <Alert className="border-primary bg-primary/5">
                    <Wand2 className="h-4 w-4" />
                    <AlertDescription className="text-primary">
                      {insights.personalizedGreeting}
                    </AlertDescription>
                  </Alert>
                  
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-3xl font-bold mb-2">
                      <span className={getHealthScoreColor(insights.financialHealthScore)}>
                        {insights.financialHealthScore}
                      </span>
                      <span className="text-muted-foreground">/100</span>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">Financial Health Score</div>
                    <Progress value={insights.financialHealthScore} className="h-2" />
                  </div>
                </div>

                <Tabs defaultValue="insights" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 text-xs">
                    <TabsTrigger value="insights">Insights</TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                    <TabsTrigger value="budget">Budget</TabsTrigger>
                    <TabsTrigger value="tips">Tips</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="insights" className="space-y-4 mt-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Key Insights
                    </h3>
                    <div className="space-y-2">
                      {insights.keyInsights.map((insight, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="actions" className="space-y-4 mt-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Priority Actions
                    </h3>
                    <div className="space-y-3">
                      {insights.prioritizedRecommendations.map((rec, index) => (
                        <div key={index} className="border border-border rounded-lg p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm">{rec.title}</h4>
                            <Badge className={cn("text-xs", getPriorityColor(rec.priority))}>
                              {rec.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{rec.description}</p>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Timeline:</span> {rec.timeframe}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="budget" className="space-y-4 mt-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Budget Suggestion
                    </h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-lg font-bold text-blue-600">{insights.monthlyBudgetSuggestion.needs}%</div>
                          <div className="text-xs text-muted-foreground">Needs</div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-lg font-bold text-orange-600">{insights.monthlyBudgetSuggestion.wants}%</div>
                          <div className="text-xs text-muted-foreground">Wants</div>
                        </div>
                        <div className="text-center p-3 bg-emerald-50 rounded-lg">
                          <div className="text-lg font-bold text-emerald-600">{insights.monthlyBudgetSuggestion.savings}%</div>
                          <div className="text-xs text-muted-foreground">Savings</div>
                        </div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm">{insights.monthlyBudgetSuggestion.reasoning}</p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="tips" className="space-y-4 mt-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Specific Tips
                    </h3>
                    <div className="space-y-2">
                      {insights.specificTips.map((tip, index) => (
                        <div key={index} className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200">
                          <p className="text-sm">{tip}</p>
                        </div>
                      ))}
                    </div>
                    
                    {insights.warningSignals && insights.warningSignals.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm text-orange-600 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Watch Out For
                        </h4>
                        {insights.warningSignals.map((warning, index) => (
                          <div key={index} className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200">
                            <p className="text-sm text-orange-700 dark:text-orange-300">{warning}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <Alert className="border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
                      <Target className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                        {insights.encouragement}
                      </AlertDescription>
                    </Alert>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
