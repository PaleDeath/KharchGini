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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, PlusCircle, Loader2, Repeat } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { RecurringTransaction, TransactionType, RecurringFrequency } from "@/lib/types";
import { addRecurringTransaction, calculateNextDueDate } from '@/lib/firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';

const recurringTransactionFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive (₹)"),
  type: z.enum(["income", "expense"], { required_error: "Type is required" }),
  category: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"], { required_error: "Frequency is required" }),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date().optional(),
});

type RecurringTransactionFormValues = z.infer<typeof recurringTransactionFormSchema>;

interface AddRecurringTransactionDialogProps {
  onRecurringTransactionAdded: (newRecurringTransaction: RecurringTransaction) => void; 
}

const frequencyLabels: Record<RecurringFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly", 
  monthly: "Monthly",
  yearly: "Yearly"
};

// Common categories for both income and expense
const expenseCategories = [
  "Food & Dining",
  "Transportation", 
  "Shopping",
  "Bills & Utilities",
  "Healthcare",
  "Entertainment",
  "Education",
  "Travel & Vacation",
  "Insurance",
  "Personal Care",
  "Home & Garden",
  "Gifts & Donations",
  "Professional Services",
  "Miscellaneous"
];

const incomeCategories = [
  "Salary",
  "Business Income",
  "Investment Returns",
  "Rental Income",
  "Other Income"
];

export function AddRecurringTransactionDialog({ onRecurringTransactionAdded }: AddRecurringTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<RecurringTransactionFormValues>({
    resolver: zodResolver(recurringTransactionFormSchema),
    defaultValues: {
      description: "",
      amount: 0,
      type: "expense",
      category: "",
      frequency: "monthly",
      startDate: new Date(),
    },
  });

  const selectedType = form.watch('type');
  const availableCategories = selectedType === 'income' ? incomeCategories : expenseCategories;

  const onSubmit = async (data: RecurringTransactionFormValues) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in to add recurring transactions." });
      return;
    }
    
    setIsLoading(true);
    try {
      const startDateStr = format(data.startDate, "yyyy-MM-dd");
      const nextDueDate = calculateNextDueDate(startDateStr, data.frequency);
      
      const recurringTransactionData = {
        description: data.description,
        amount: data.amount,
        type: data.type,
        category: data.category || undefined,
        frequency: data.frequency,
        startDate: startDateStr,
        endDate: data.endDate ? format(data.endDate, "yyyy-MM-dd") : undefined,
        nextDueDate: startDateStr, // First execution should be on start date
        isActive: true,
      };

      // Save to Firestore
      const newRecurringTransaction = await addRecurringTransaction(user.uid, recurringTransactionData);
      
      toast({ 
        title: "Recurring Transaction Added", 
        description: `"${data.description}" will repeat ${data.frequency}ly starting ${format(data.startDate, 'PPP')}.` 
      });
      onRecurringTransactionAdded(newRecurringTransaction); 
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Error adding recurring transaction:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add recurring transaction." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Repeat className="h-4 w-4" />
          Add Recurring
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            Add Recurring Transaction
          </DialogTitle>
          <DialogDescription>
            Set up a transaction that automatically repeats on a schedule. Perfect for salaries, rent, subscriptions, and bills.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input 
              id="description" 
              {...form.register("description")} 
              placeholder="e.g., Monthly rent, Salary, Netflix subscription" 
              className={cn(form.formState.errors.description && "border-destructive")} 
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input 
                id="amount" 
                type="number" 
                step="1" 
                {...form.register("amount")} 
                placeholder="e.g., 15000" 
                className={cn(form.formState.errors.amount && "border-destructive")} 
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value as TransactionType}>
                    <SelectTrigger id="type" className={cn(form.formState.errors.type && "border-destructive")}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Money In</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.type && (
                <p className="text-xs text-destructive">{form.formState.errors.type.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Select value={form.watch('category')} onValueChange={(value) => form.setValue('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Controller
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value as RecurringFrequency}>
                    <SelectTrigger id="frequency" className={cn(form.formState.errors.frequency && "border-destructive")}>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(frequencyLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.frequency && (
                <p className="text-xs text-destructive">{form.formState.errors.frequency.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Controller
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "justify-start text-left font-normal",
                          !field.value && "text-muted-foreground",
                          form.formState.errors.startDate && "border-destructive"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick start date</span>}
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
              {form.formState.errors.startDate && (
                <p className="text-xs text-destructive">{form.formState.errors.startDate.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Controller
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>No end date</span>}
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
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Repeat className="mr-2 h-4 w-4" />}
              {isLoading ? "Creating..." : "Create Recurring Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 