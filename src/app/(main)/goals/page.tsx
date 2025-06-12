
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/page-header";
import { AddGoalDialog } from "@/components/add-goal-dialog";
import { EditGoalDialog } from "@/components/edit-goal-dialog";
import { QuickContributionDialog } from "@/components/quick-contribution-dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { FinancialGoal } from "@/lib/types";
import { deleteGoal } from '@/lib/firebase/firestore'; 
import { useToast } from "@/hooks/use-toast";
import { Target, Edit, Trash2, Plus, MoreHorizontal } from "lucide-react";
import { useGoals } from '@/hooks/use-firestore-data';
import { useAuth } from '@/contexts/auth-context';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function GoalsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { goals, loading, error, refreshGoals } = useGoals();

  const handleGoalAdded = (newGoal: FinancialGoal) => {
     // Refresh goals from Firestore to get the latest data
     refreshGoals();
     toast({ title: "Goal Added", description: `'${newGoal.name}' has been successfully added.`});
  };

  const handleGoalUpdated = (updatedGoal: FinancialGoal) => {
    // Refresh goals from Firestore to get the latest data
    refreshGoals();
    toast({ title: "Goal Updated", description: `'${updatedGoal.name}' has been updated successfully.`});
  };
  

  const handleDeleteGoal = async (goalId: string) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }
    try {
      await deleteGoal(user.uid, goalId);
      // Refresh goals from Firestore to get the latest data
      refreshGoals();
      toast({ title: "Success", description: "Goal deleted." });
    } catch (error) {
      console.error("Error deleting goal:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete goal." });
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
                  <div className="flex-1">
                  <CardTitle className="text-xl">{goal.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Target: {formatCurrency(goal.targetAmount)}
                      {goal.targetDate && ` by ${new Date(goal.targetDate + 'T00:00:00').toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground -mt-2 -mr-2">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <EditGoalDialog goal={goal} onGoalUpdated={handleGoalUpdated}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Goal
                        </DropdownMenuItem>
                      </EditGoalDialog>
                      <DropdownMenuSeparator />
                   <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive cursor-pointer">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Goal
                          </DropdownMenuItem>
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
              <CardFooter className="flex gap-2">
                <QuickContributionDialog goal={goal} onGoalUpdated={handleGoalUpdated}>
                  <Button className="flex-1">
                    <Plus className="mr-2 h-4 w-4" /> Add Money
                </Button>
                </QuickContributionDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
