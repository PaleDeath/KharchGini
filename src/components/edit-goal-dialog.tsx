"use client";

import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { updateGoal } from '@/services/goals';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import type { FinancialGoal } from "@/lib/types";

const goalFormSchema = z.object({
  name: z.string().min(1, "Goal name is required."),
  targetAmount: z.coerce.number().positive("Target amount must be positive."),
  currentAmount: z.coerce.number().min(0, "Current amount cannot be negative."),
  targetDate: z.string().optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

interface EditGoalDialogProps {
  goal: FinancialGoal;
  onGoalUpdated: (updatedGoal: FinancialGoal) => void;
  children: React.ReactNode; // Trigger element
}

export function EditGoalDialog({ goal, onGoalUpdated, children }: EditGoalDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      targetDate: goal.targetDate || '',
    },
  });

  // Reset form when goal changes
  useState(() => {
    form.reset({
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      targetDate: goal.targetDate || '',
    });
  });

  const onSubmit = async (data: GoalFormValues) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }

    setIsLoading(true);
    try {
      const updates: Partial<FinancialGoal> = {
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount,
        targetDate: data.targetDate || undefined,
      };

      await updateGoal(user.uid, goal.id, updates);

      const updatedGoal: FinancialGoal = {
        ...goal,
        ...updates,
      };

      onGoalUpdated(updatedGoal);
      setOpen(false);
      toast({ title: "Goal Updated", description: "Your financial goal has been updated successfully." });
    } catch (error) {
      console.error("Error updating goal:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update goal. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Financial Goal</DialogTitle>
          <DialogDescription>
            Update your goal details and track your progress toward achieving it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Goal Name</Label>
            <Input 
              id="edit-name" 
              {...form.register("name")} 
              placeholder="e.g., Emergency Fund, New Car, Vacation"
              disabled={isLoading}
            />
            {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
          </div>
          
          <div>
            <Label htmlFor="edit-targetAmount">Target Amount (₹)</Label>
            <Input 
              id="edit-targetAmount" 
              type="number" 
              step="100" 
              {...form.register("targetAmount")} 
              placeholder="e.g., 100000"
              disabled={isLoading}
            />
            {form.formState.errors.targetAmount && <p className="text-xs text-destructive mt-1">{form.formState.errors.targetAmount.message}</p>}
          </div>
          
          <div>
            <Label htmlFor="edit-currentAmount">Current Amount (₹)</Label>
            <Input 
              id="edit-currentAmount" 
              type="number" 
              step="100" 
              {...form.register("currentAmount")} 
              placeholder="e.g., 25000"
              disabled={isLoading}
            />
            {form.formState.errors.currentAmount && <p className="text-xs text-destructive mt-1">{form.formState.errors.currentAmount.message}</p>}
          </div>
          
          <div>
            <Label htmlFor="edit-targetDate">Target Date (Optional)</Label>
            <Input 
              id="edit-targetDate" 
              type="date" 
              {...form.register("targetDate")} 
              disabled={isLoading}
            />
            {form.formState.errors.targetDate && <p className="text-xs text-destructive mt-1">{form.formState.errors.targetDate.message}</p>}
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Goal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 