
"use client";

import { useState } from 'react';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, PlusCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { addGoal } from '@/services/goals';
import { useToast } from "@/hooks/use-toast";
import type { FinancialGoal } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';

const goalFormSchema = z.object({
  name: z.string().min(1, "Goal name is required"),
  targetAmount: z.coerce.number().positive("Target amount must be positive (₹)"),
  currentAmount: z.coerce.number().min(0, "Current amount cannot be negative (₹)").optional(),
  targetDate: z.date().optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

interface AddGoalDialogProps {
  onGoalAdded: (newGoal: FinancialGoal) => void;
}

export function AddGoalDialog({ onGoalAdded }: AddGoalDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: "",
      targetAmount: 10000, // Default to an INR amount
      currentAmount: 0,
    },
  });

  const onSubmit = async (data: GoalFormValues) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in to add goals." });
      return;
    }
    
    setIsLoading(true);
    try {
      const goalData = {
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount || 0,
        targetDate: data.targetDate ? format(data.targetDate, "yyyy-MM-dd") : undefined,
      };

      // Save to Firestore
      const newGoal = await addGoal(user.uid, goalData);
      
      toast({ title: "Success", description: "Financial goal added successfully." });
      onGoalAdded(newGoal); // Pass the newly created goal back
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Error adding goal:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add goal." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Goal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Financial Goal</DialogTitle>
          <DialogDescription>
            Set your financial targets and track your progress. All amounts in INR (₹).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Goal Name</Label>
            <div className="col-span-3">
              <Input id="name" {...form.register("name")} placeholder="e.g., Buy a new scooter" className={cn(form.formState.errors.name && "border-destructive")} />
              {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="targetAmount" className="text-right">Target (₹)</Label>
            <div className="col-span-3">
              <Input id="targetAmount" type="number" step="1" {...form.register("targetAmount")} placeholder="e.g., 75000" className={cn(form.formState.errors.targetAmount && "border-destructive")} />
              {form.formState.errors.targetAmount && <p className="text-xs text-destructive mt-1">{form.formState.errors.targetAmount.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="currentAmount" className="text-right">Current (₹)</Label>
            <div className="col-span-3">
              <Input id="currentAmount" type="number" step="1" {...form.register("currentAmount")} placeholder="e.g., 10000" className={cn(form.formState.errors.currentAmount && "border-destructive")} />
              {form.formState.errors.currentAmount && <p className="text-xs text-destructive mt-1">{form.formState.errors.currentAmount.message}</p>}
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="targetDate" className="text-right">Target Date</Label>
            <div className="col-span-3">
              <Controller
                control={form.control}
                name="targetDate"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground",
                           form.formState.errors.targetDate && "border-destructive"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date (Optional)</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {form.formState.errors.targetDate && <p className="text-xs text-destructive mt-1">{form.formState.errors.targetDate.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Saving..." : "Save Goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
