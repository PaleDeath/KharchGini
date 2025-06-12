"use client";

import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addBudget } from '@/lib/firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import type { Budget } from "@/lib/types";
import { useAuth } from '@/contexts/auth-context';
import { Loader2, Plus, Target } from "lucide-react";
import { cn } from '@/lib/utils';

// Common expense categories for Indian users
const BUDGET_CATEGORIES = [
  'Food & Dining',
  'Transportation', 
  'Shopping',
  'Bills & Utilities',
  'Healthcare',
  'Entertainment',
  'Education',
  'Travel & Vacation',
  'Insurance',
  'Personal Care',
  'Home & Garden',
  'Gifts & Donations',
  'Professional Services',
  'Miscellaneous'
];

const budgetFormSchema = z.object({
  month: z.string().min(1, "Please select a month."),
  category: z.string().min(1, "Please select a category."),
  budgetAmount: z.coerce.number().positive("Budget amount must be greater than 0."),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

interface AddBudgetDialogProps {
  onBudgetAdded: (newBudget: Budget) => void;
  defaultMonth?: string;
}

export function AddBudgetDialog({ onBudgetAdded, defaultMonth }: AddBudgetDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Generate month options (current month + next 11 months)
  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = date.toISOString().slice(0, 7); // YYYY-MM format
      const displayStr = date.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long' 
      });
      options.push({ value: monthStr, label: displayStr });
    }
    
    return options;
  };

  const monthOptions = generateMonthOptions();

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      month: defaultMonth || monthOptions[0]?.value || '',
      category: '',
      budgetAmount: 0,
    },
  });

  const onSubmit = async (data: BudgetFormValues) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }

    setIsLoading(true);
    try {
      const newBudget = await addBudget(user.uid, {
        month: data.month,
        category: data.category,
        budgetAmount: data.budgetAmount,
      });

      onBudgetAdded(newBudget);
      toast({ title: "Budget Created", description: `Budget for ${data.category} has been set.` });
      
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Error adding budget:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to create budget. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Budget
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Create New Budget
          </DialogTitle>
          <DialogDescription>
            Set a spending limit for a specific category this month. Track your progress and get alerts when you're close to your limit.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="month">Month</Label>
              <Select value={form.watch('month')} onValueChange={(value) => form.setValue('month', value)}>
                <SelectTrigger className={cn(form.formState.errors.month && "border-destructive")}>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.month && (
                <p className="text-xs text-destructive">{form.formState.errors.month.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select value={form.watch('category')} onValueChange={(value) => form.setValue('category', value)}>
                <SelectTrigger className={cn(form.formState.errors.category && "border-destructive")}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.category && (
                <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="budgetAmount">Budget Amount (₹)</Label>
              <Input
                id="budgetAmount"
                type="number"
                step="100"
                placeholder="e.g., 15000"
                {...form.register("budgetAmount")}
                className={cn(form.formState.errors.budgetAmount && "border-destructive")}
                disabled={isLoading}
              />
              {form.formState.errors.budgetAmount && (
                <p className="text-xs text-destructive">{form.formState.errors.budgetAmount.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
              {isLoading ? "Creating..." : "Create Budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 