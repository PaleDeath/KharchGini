'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertCircle, 
  CheckCircle, 
  Lightbulb,
  PiggyBank,
  Shield,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BudgetRecommendation {
  category: string;
  recommendedAmount: number;
  currentAmount: number;
  difference: number;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  tips: string[];
}

interface BudgetRecommendationsData {
  recommendations: BudgetRecommendation[];
  totalRecommendedBudget: number;
  currentTotalExpenses: number;
  savingsRate: number;
  emergencyFundRecommendation: number;
  insights: string[];
  actionItems: Array<{
    action: string;
    impact: 'high' | 'medium' | 'low';
    difficulty: 'easy' | 'medium' | 'hard';
    timeframe: string;
  }>;
}

interface BudgetRecommendationsProps {
  data: BudgetRecommendationsData | null;
  isLoading: boolean;
  onGenerateRecommendations: () => void;
  className?: string;
}

export function BudgetRecommendations({ 
  data, 
  isLoading, 
  onGenerateRecommendations, 
  className 
}: BudgetRecommendationsProps) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!data && !isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Brain className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle>AI Budget Recommendations</CardTitle>
          <CardDescription>
            Get personalized budget recommendations based on your spending patterns and financial goals
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={onGenerateRecommendations} className="w-full">
            <Brain className="h-4 w-4 mr-2" />
            Generate Smart Recommendations
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <CardTitle>Analyzing Your Finances</CardTitle>
          <CardDescription>
            Our AI is analyzing your spending patterns and generating personalized recommendations...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high': return <TrendingUp className="h-4 w-4" />;
      case 'medium': return <Target className="h-4 w-4" />;
      case 'low': return <TrendingDown className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          <CardTitle>AI Budget Recommendations</CardTitle>
        </div>
        <CardDescription>
          Personalized recommendations based on your financial profile
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <PiggyBank className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Recommended Savings Rate</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {data.savingsRate.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Emergency Fund</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    ₹{data.emergencyFundRecommendation.toLocaleString('en-IN')}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">Budget Optimization</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    ₹{(data.currentTotalExpenses - data.totalRecommendedBudget).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-muted-foreground">Potential savings</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Budget vs Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Current Expenses</span>
                    <span className="font-medium">₹{data.currentTotalExpenses.toLocaleString('en-IN')}</span>
                  </div>
                  <Progress 
                    value={(data.currentTotalExpenses / (data.currentTotalExpenses + 10000)) * 100} 
                    className="h-2" 
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Recommended Budget</span>
                    <span className="font-medium text-green-600">₹{data.totalRecommendedBudget.toLocaleString('en-IN')}</span>
                  </div>
                  <Progress 
                    value={(data.totalRecommendedBudget / (data.currentTotalExpenses + 10000)) * 100} 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="space-y-3">
              {data.recommendations.map((rec, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{rec.category}</h4>
                        <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                      </div>
                      <Badge variant={getPriorityColor(rec.priority)}>
                        {rec.priority}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Current</div>
                        <div className="font-medium">₹{rec.currentAmount.toLocaleString('en-IN')}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Recommended</div>
                        <div className="font-medium text-blue-600">₹{rec.recommendedAmount.toLocaleString('en-IN')}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Difference</div>
                        <div className={cn(
                          "font-medium flex items-center gap-1",
                          rec.difference > 0 ? "text-red-600" : "text-green-600"
                        )}>
                          {rec.difference > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          ₹{Math.abs(rec.difference).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {rec.tips.length > 0 && (
                      <div className="border-t pt-3">
                        <div className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" />
                          Tips
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {rec.tips.map((tip, tipIndex) => (
                            <li key={tipIndex} className="flex items-start gap-2">
                              <div className="w-1 h-1 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="space-y-3">
              {data.insights.map((insight, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Lightbulb className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm">{insight}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <div className="space-y-3">
              {data.actionItems.map((action, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          action.impact === 'high' && "bg-red-100",
                          action.impact === 'medium' && "bg-yellow-100",
                          action.impact === 'low' && "bg-green-100"
                        )}>
                          {getImpactIcon(action.impact)}
                        </div>
                        <div>
                          <h4 className="font-medium">{action.action}</h4>
                          <p className="text-sm text-muted-foreground">
                            {action.timeframe} • {action.difficulty} difficulty
                          </p>
                        </div>
                      </div>
                      <Badge variant={getPriorityColor(action.impact)}>
                        {action.impact} impact
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 pt-4 border-t">
          <Button 
            onClick={onGenerateRecommendations} 
            variant="outline" 
            className="w-full"
          >
            <Brain className="h-4 w-4 mr-2" />
            Refresh Recommendations
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
