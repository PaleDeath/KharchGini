"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Wand2, TrendingUp, TrendingDown, Equal, Sparkles, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { useTransactions } from '@/hooks/use-firestore-data';
import { generateSmartBudgetSuggestions, generateQuickBudgetTemplates, type BudgetSuggestion, type SmartBudgetRecommendation } from '@/lib/smart-budget-engine';
import { addBudget } from '@/services/budgets';
import type { Budget } from "@/lib/types";
import { cn } from '@/lib/utils';

interface SmartBudgetDialogProps {
  onBudgetsCreated: (budgets: Budget[]) => void;
  defaultMonth?: string;
  children: React.ReactNode;
}

export function SmartBudgetDialog({ onBudgetsCreated, defaultMonth, children }: SmartBudgetDialogProps) {
  const [open, setOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [recommendation, setRecommendation] = useState<SmartBudgetRecommendation | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Map<string, number>>(new Map());
  const [useTemplates, setUseTemplates] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { transactions } = useTransactions();
  
  const currentMonth = new Date().toISOString().slice(0, 7);
  const targetMonth = defaultMonth || currentMonth;

  const analyzeSpending = async () => {
    if (transactions.length === 0) {
      // Use templates for new users
      setUseTemplates(true);
      const templates = generateQuickBudgetTemplates();
      setRecommendation({
        targetMonth,
        suggestions: templates,
        totalSuggestedBudget: templates.reduce((sum, t) => sum + t.suggestedAmount, 0),
        analysisMetadata: {
          monthsAnalyzed: 0,
          totalTransactions: 0,
          categoriesFound: templates.length,
          overallConfidence: 'medium'
        }
      });
      setSelectedSuggestions(new Set(templates.map(t => t.category)));
      return;
    }

    setIsAnalyzing(true);
    try {
      // Simulate analysis delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const smartRecommendation = generateSmartBudgetSuggestions(transactions, targetMonth, 6);
      
      if (smartRecommendation.suggestions.length === 0) {
        // Fallback to templates if no historical data
        setUseTemplates(true);
        const templates = generateQuickBudgetTemplates();
        setRecommendation({
          targetMonth,
          suggestions: templates,
          totalSuggestedBudget: templates.reduce((sum, t) => sum + t.suggestedAmount, 0),
          analysisMetadata: {
            monthsAnalyzed: 0,
            totalTransactions: 0,
            categoriesFound: templates.length,
            overallConfidence: 'medium'
          }
        });
        setSelectedSuggestions(new Set(templates.map(t => t.category)));
      } else {
        setRecommendation(smartRecommendation);
        // Auto-select high and medium confidence suggestions
        const autoSelected = smartRecommendation.suggestions
          .filter(s => s.confidence === 'high' || s.confidence === 'medium')
          .map(s => s.category);
        setSelectedSuggestions(new Set(autoSelected));
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to analyze spending patterns." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSuggestionToggle = (category: string, checked: boolean) => {
    const newSelected = new Set(selectedSuggestions);
    if (checked) {
      newSelected.add(category);
    } else {
      newSelected.delete(category);
    }
    setSelectedSuggestions(newSelected);
  };

  const handleAmountChange = (category: string, amount: number) => {
    const newCustomAmounts = new Map(customAmounts);
    newCustomAmounts.set(category, amount);
    setCustomAmounts(newCustomAmounts);
  };

  const createBudgets = async () => {
    if (!user?.uid || !recommendation) {
      toast({ variant: "destructive", title: "Error", description: "Unable to create budgets." });
      return;
    }

    setIsCreating(true);
    try {
      const budgetsToCreate = recommendation.suggestions.filter(s => selectedSuggestions.has(s.category));
      const createdBudgets: Budget[] = [];

      for (const suggestion of budgetsToCreate) {
        const amount = customAmounts.get(suggestion.category) || suggestion.suggestedAmount;
        
        const budget = await addBudget(user.uid, {
          month: targetMonth,
          category: suggestion.category,
          budgetAmount: amount
        });
        
        createdBudgets.push(budget);
      }

      onBudgetsCreated(createdBudgets);
      setOpen(false);
      
      toast({ 
        title: "Smart Budgets Created! 🎯", 
        description: `Created ${createdBudgets.length} budget${createdBudgets.length !== 1 ? 's' : ''} for ${new Date(targetMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.` 
      });
    } catch (error) {
      console.error("Error creating budgets:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to create budgets." });
    } finally {
      setIsCreating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getConfidenceColor = (confidence: 'low' | 'medium' | 'high') => {
    switch (confidence) {
      case 'high': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low': return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const getTrendIcon = (trend: 'increasing' | 'decreasing' | 'stable') => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-emerald-500" />;
      case 'stable': return <Equal className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const resetDialog = () => {
    setRecommendation(null);
    setSelectedSuggestions(new Set());
    setCustomAmounts(new Map());
    setUseTemplates(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetDialog();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Smart Budget Creation
          </DialogTitle>
          <DialogDescription>
            AI-powered budget suggestions based on your spending patterns
          </DialogDescription>
        </DialogHeader>

        {!recommendation ? (
          <div className="space-y-4">
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Ready to Create Smart Budgets?</h3>
              <p className="text-muted-foreground mb-4">
                {transactions.length > 0 
                  ? `Analyzing ${transactions.length} transactions to create personalized budget suggestions.`
                  : "We'll create starter budgets based on typical Indian household spending."
                }
              </p>
              <Button onClick={analyzeSpending} disabled={isAnalyzing} className="gap-2">
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {isAnalyzing ? "Analyzing..." : "Generate Smart Budgets"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Analysis Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Analysis Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Data Source</p>
                    <p className="font-medium">
                      {useTemplates ? 'Templates' : `${recommendation.analysisMetadata.monthsAnalyzed} months`}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Categories</p>
                    <p className="font-medium">{recommendation.analysisMetadata.categoriesFound}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Budget</p>
                    <p className="font-medium">{formatCurrency(recommendation.totalSuggestedBudget)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Confidence</p>
                    <Badge className={cn("text-xs", getConfidenceColor(recommendation.analysisMetadata.overallConfidence))}>
                      {recommendation.analysisMetadata.overallConfidence}
                    </Badge>
                  </div>
                </div>
                
                {useTemplates && (
                  <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Using template budgets based on typical Indian household spending. Add more transaction history for personalized suggestions.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Budget Suggestions */}
            <div className="space-y-3">
              <h3 className="font-semibold">Budget Suggestions</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {recommendation.suggestions.map((suggestion) => {
                  const isSelected = selectedSuggestions.has(suggestion.category);
                  const customAmount = customAmounts.get(suggestion.category);
                  
                  return (
                    <Card key={suggestion.category} className={cn(
                      "transition-colors",
                      isSelected && "ring-2 ring-primary bg-primary/5"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSuggestionToggle(suggestion.category, checked as boolean)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{suggestion.category}</span>
                                {getTrendIcon(suggestion.trend)}
                                <Badge className={cn("text-xs", getConfidenceColor(suggestion.confidence))}>
                                  {suggestion.confidence}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{suggestion.reasoning}</p>
                              {!useTemplates && suggestion.historicalData.monthsAnalyzed > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Avg: {formatCurrency(suggestion.historicalData.averageSpending)} • 
                                  Range: {formatCurrency(suggestion.historicalData.minSpending)}-{formatCurrency(suggestion.historicalData.maxSpending)}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <Input
                              type="number"
                              value={customAmount || suggestion.suggestedAmount}
                              onChange={(e) => handleAmountChange(suggestion.category, parseInt(e.target.value) || 0)}
                              className="w-24 text-right text-sm"
                              disabled={!isSelected}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Selected Summary */}
            {selectedSuggestions.size > 0 && (
              <Card className="bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Creating {selectedSuggestions.size} budget{selectedSuggestions.size !== 1 ? 's' : ''}</p>
                      <p className="text-sm text-muted-foreground">
                        Total: {formatCurrency(
                          recommendation.suggestions
                            .filter(s => selectedSuggestions.has(s.category))
                            .reduce((sum, s) => sum + (customAmounts.get(s.category) || s.suggestedAmount), 0)
                        )}
                      </p>
                    </div>
                    <Button onClick={createBudgets} disabled={isCreating} className="gap-2">
                      {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {isCreating ? "Creating..." : "Create Budgets"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedSuggestions.size === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Select at least one budget suggestion to continue.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 