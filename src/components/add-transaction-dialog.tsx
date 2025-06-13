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
import { CalendarIcon, PlusCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/lib/types";
import { categorizeTransactionAction } from '@/actions/transaction-actions';
import { addTransaction } from '@/lib/firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';

const transactionFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive (₹)"),
  type: z.enum(["income", "expense"], { required_error: "Type is required" }),
  date: z.date({ required_error: "Date is required" }),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface AddTransactionDialogProps {
  onTransactionAdded: (newTransaction: Transaction) => void; 
}

export function AddTransactionDialog({ onTransactionAdded }: AddTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Detect iOS for better date picker experience
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      description: "",
      amount: 0,
      type: "expense",
      date: new Date(),
    },
  });

  const onSubmit = async (data: TransactionFormValues) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }

    setIsLoading(true);
    try {
      // Try to auto-categorize if description is provided
      let category = '';
      try {
        if (data.description.length > 3) {
          const result = await categorizeTransactionAction(data.description);
          if (result.success && result.category && result.confidence && result.confidence > 0.7) {
            category = result.category;
          }
        }
      } catch (error) {
        // Categorization failed, continue without category
        console.log('Auto-categorization failed:', error);
      }

      const transaction: Omit<Transaction, 'id'> = {
        ...data,
        date: data.date.toISOString().split('T')[0], // Convert to YYYY-MM-DD
        category: category || undefined
      };

      const newTransaction = await addTransaction(user.uid, transaction);
      onTransactionAdded(newTransaction);
      form.reset();
      setOpen(false);
      
      if (category) {
        toast({ 
          title: "Transaction Added", 
          description: `Transaction saved and auto-categorized as "${category}".` 
        });
      } else {
        toast({ 
          title: "Transaction Added", 
          description: "Your transaction has been recorded." 
        });
      }
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add transaction." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Add a new income or expense transaction to track your finances.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <div className="col-span-3">
              <Input
                id="description"
                placeholder="e.g., Grocery shopping"
                {...form.register("description")}
                className={cn(form.formState.errors.description && "border-destructive")}
                disabled={isLoading}
              />
              {form.formState.errors.description && <p className="text-xs text-destructive mt-1">{form.formState.errors.description.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">Amount (₹)</Label>
            <div className="col-span-3">
              <Input
                id="amount"
                type="number"
                step="1"
                placeholder="e.g., 1500"
                {...form.register("amount")}
                className={cn(form.formState.errors.amount && "border-destructive")}
                disabled={isLoading}
              />
              {form.formState.errors.amount && <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">Type</Label>
            <div className="col-span-3">
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                    <SelectTrigger className={cn(form.formState.errors.type && "border-destructive")}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Money In</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.type && <p className="text-xs text-destructive mt-1">{form.formState.errors.type.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">Date</Label>
            <div className="col-span-3">
              <Controller
                control={form.control}
                name="date"
                render={({ field }) => (
                  <>
                    {isIOS ? (
                      // Native date input for iOS - better compatibility
                      <Input
                        type="date"
                        value={field.value ? field.value.toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
                          field.onChange(date);
                        }}
                        className={cn(
                          "w-full",
                          !field.value && "text-muted-foreground",
                          form.formState.errors.date && "border-destructive"
                        )}
                        disabled={isLoading}
                      />
                    ) : (
                      // Calendar picker for other devices
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground",
                              form.formState.errors.date && "border-destructive"
                            )}
                            disabled={isLoading}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            defaultMonth={field.value || new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </>
                )}
              />
              {form.formState.errors.date && <p className="text-xs text-destructive mt-1">{form.formState.errors.date.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Saving..." : "Save Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
