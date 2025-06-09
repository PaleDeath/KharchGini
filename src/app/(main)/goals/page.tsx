
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/page-header";
import { AddGoalDialog } from "@/components/add-goal-dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { FinancialGoal } from "@/lib/types";
import { deleteGoalAction } from '@/actions/goal-actions'; 
import { useToast } from "@/hooks/use-toast";
import { Target, Edit, Trash2 } from "lucide-react";
import { differenceInDays, formatDistanceToNowStrict, parseISO } from 'date-fns';
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

export default function GoalsPage() {
  const [goals, setGoals] = useState<FinancialGoal[]>([]); // Initialize with empty array
  const { toast } = useToast();

  // In a real app with a backend, fetchGoals would retrieve data.
  // For local state, this is less critical unless we add localStorage persistence.
  const fetchGoals = useCallback(() => {
    // Simulate fetching data or load from localStorage if implemented
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleGoalAdded = (newGoal: FinancialGoal) => {
     setGoals(prev => [newGoal, ...prev].sort((a, b) => (a.targetDate && b.targetDate) ? new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime() : 0));
     toast({ title: "Goal Added", description: `'${newGoal.name}' has been successfully added.`});
  };
  

  const handleDeleteGoal = async (goalId: string) => {
    const result = await deleteGoalAction(goalId); // This is a mock action
    if (result.success) {
      setGoals(prev => prev.filter(g => g.id !== goalId));
      toast({ title: "Success", description: "Goal deleted." });
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error || "Failed to delete goal." });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const getTimeRemaining = (targetDateStr?: string): string | null => {
    if (!targetDateStr) return null;
    const targetDate = parseISO(targetDateStr);
    const now = new Date();
    now.setHours(0,0,0,0); // Compare against start of today

    if (targetDate.getTime() < now.getTime()) return "Overdue";
    return formatDistanceToNowStrict(targetDate, { addSuffix: true });
  };


  return (
    <>
      <PageHeader
        title="Financial Goals"
        description="Set and track your financial objectives."
        actions={<AddGoalDialog onGoalAdded={handleGoalAdded} />}
      />
      {goals.length === 0 ? (
        <Card className="shadow-md text-center py-10">
          <CardHeader>
            <div className="flex justify-center mb-4">
             <Target className="mx-auto h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle>No Goals Yet</CardTitle>
            <CardDescription>Start planning for your future by adding your first financial goal.</CardDescription>
          </CardHeader>
          <CardContent>
             <AddGoalDialog onGoalAdded={handleGoalAdded} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Card key={goal.id} className="shadow-md flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{goal.name}</CardTitle>
                   <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive -mt-2 -mr-2">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Goal: {goal.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this financial goal.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteGoal(goal.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
                <CardDescription>
                  Target: {formatCurrency(goal.targetAmount)}
                  {goal.targetDate && ` by ${new Date(goal.targetDate + 'T00:00:00').toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="mb-2">
                  <span className="text-sm font-medium">Progress: {formatCurrency(goal.currentAmount)}</span>
                  <span className="text-xs text-muted-foreground"> ({Math.min(100, Math.max(0,(goal.currentAmount / goal.targetAmount) * 100)).toFixed(1)}%)</span>
                </div>
                <Progress value={Math.min(100, Math.max(0,(goal.currentAmount / goal.targetAmount) * 100))} className="h-3" />
                {goal.targetDate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Time remaining: {getTimeRemaining(goal.targetDate)}
                  </p>
                )}
                 {!goal.targetDate && <p className="text-xs text-muted-foreground mt-2">No target date set.</p>}
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" className="w-full" onClick={() => toast({title: "Coming Soon!", description:"Editing contributions will be available in a future update."})}>
                  <Edit className="mr-2 h-4 w-4" /> Update Contribution
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
