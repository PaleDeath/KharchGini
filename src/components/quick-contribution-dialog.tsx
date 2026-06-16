"use client";

import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { updateGoal } from '@/services/goals';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import type { FinancialGoal } from "@/lib/types";

const contributionFormSchema = z.object({
  amount: z.coerce.number().positive("Contribution amount must be positive."),
});

type ContributionFormValues = z.infer<typeof contributionFormSchema>;

interface QuickContributionDialogProps {
  goal: FinancialGoal;
  onGoalUpdated: (updatedGoal: FinancialGoal) => void;
  children: React.ReactNode;
}

export function QuickContributionDialog({ goal, onGoalUpdated, children }: QuickContributionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<ContributionFormValues>({
    resolver: zodResolver(contributionFormSchema),
    defaultValues: {
      amount: 1000, // Default contribution amount
    },
  });

  // Quick amount buttons
  const quickAmounts = [500, 1000, 2500, 5000, 10000];

  const handleQuickContribution = async (amount: number) => {
    await addContribution(amount);
  };

  const addContribution = async (contributionAmount: number) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }

    setIsLoading(true);
    try {
      const newCurrentAmount = goal.currentAmount + contributionAmount;
      
      await updateGoal(user.uid, goal.id, {
        currentAmount: newCurrentAmount,
      });

      const updatedGoal: FinancialGoal = {
        ...goal,
        currentAmount: newCurrentAmount,
      };

      onGoalUpdated(updatedGoal);
      setOpen(false);
      form.reset();
      
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { 
          style: 'currency', 
          currency: 'INR', 
          minimumFractionDigits: 0, 
          maximumFractionDigits: 0 
        }).format(amount);
      };

      toast({ 
        title: "Contribution Added! 🎉", 
        description: `Added ${formatCurrency(contributionAmount)} to '${goal.name}'. Total: ${formatCurrency(newCurrentAmount)}` 
      });
    } catch (error) {
      console.error("Error adding contribution:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add contribution. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: ContributionFormValues) => {
    await addContribution(data.amount);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-500" />
            Add to '{goal.name}'
          </DialogTitle>
          <DialogDescription>
            Quick and easy way to add money to your goal. 
            {remainingAmount > 0 && ` You need ${formatCurrency(remainingAmount)} more to reach your target!`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Quick Amount Buttons */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Quick Add</Label>
            <div className="grid grid-cols-2 gap-2">
              {quickAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  onClick={() => handleQuickContribution(amount)}
                  disabled={isLoading}
                  className="h-12 text-sm font-medium"
                >
                  + {formatCurrency(amount)}
                </Button>
              ))}
              {/* Remaining amount button if it's a reasonable amount */}
              {remainingAmount > 0 && remainingAmount <= 50000 && !quickAmounts.includes(remainingAmount) && (
                <Button
                  variant="outline"
                  onClick={() => handleQuickContribution(remainingAmount)}
                  disabled={isLoading}
                  className="h-12 text-sm font-medium bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 col-span-2"
                >
                  + {formatCurrency(remainingAmount)} (Complete Goal! 🎯)
                </Button>
              )}
            </div>
          </div>

          {/* Custom Amount */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-3 block">Custom Amount</Label>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Input 
                  type="number" 
                  step="100" 
                  {...form.register("amount")} 
                  placeholder="Enter amount (₹)"
                  disabled={isLoading}
                  className="text-center text-lg"
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Contribution
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 