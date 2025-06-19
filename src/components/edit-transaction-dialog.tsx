"use client";

import { useState, useEffect } from 'react';
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
import { CalendarIcon, Edit, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/lib/types";
import { updateTransaction } from '@/lib/firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';

const transactionFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive (₹)"),
  type: z.enum(["income", "expense"], { required_error: "Type is required" }),
  date: z.date({ required_error: "Date is required" }),
  category: z.string().optional(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface EditTransactionDialogProps {
  transaction: Transaction;
  onTransactionUpdated: (updatedTransaction: Transaction) => void;
  children: React.ReactNode; // Trigger element
}

export function EditTransactionDialog({ transaction, onTransactionUpdated, children }: EditTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Detect iOS for better date picker experience
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      date: parseISO(transaction.date + 'T00:00:00'),
      category: transaction.category || '',
    }
  });

  // Reset form when transaction changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        date: parseISO(transaction.date + 'T00:00:00'),
        category: transaction.category || '',
      });
    }
  }, [transaction, open, form]);

  const onSubmit = async (data: TransactionFormValues) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }

    setIsLoading(true);
    try {
      // Format date in local timezone to avoid timezone conversion issues
      const year = data.date.getFullYear();
      const month = String(data.date.getMonth() + 1).padStart(2, '0');
      const day = String(data.date.getDate()).padStart(2, '0');
      const localDateString = `${year}-${month}-${day}`;

      const updates: Partial<Transaction> = {
        description: data.description,
        amount: data.amount,
        type: data.type,
        date: localDateString, // Use local date formatting to avoid UTC conversion
        category: data.category || undefined,
      };

      await updateTransaction(user.uid, transaction.id, updates);
      
      const updatedTransaction: Transaction = {
        ...transaction,
        ...updates,
      };
      
      onTransactionUpdated(updatedTransaction);
      setOpen(false);
      toast({ title: "Success", description: "Transaction updated successfully." });
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update transaction." });
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
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Update the transaction details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-description" className="text-right">Description</Label>
            <div className="col-span-3">
              <Input
                id="edit-description"
                {...form.register("description")}
                className={cn(form.formState.errors.description && "border-destructive")}
                disabled={isLoading}
              />
              {form.formState.errors.description && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.description.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-amount" className="text-right">Amount (₹)</Label>
            <div className="col-span-3">
              <Input
                id="edit-amount"
                type="number"
                step="1"
                {...form.register("amount")}
                className={cn(form.formState.errors.amount && "border-destructive")}
                disabled={isLoading}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-type" className="text-right">Type</Label>
            <div className="col-span-3">
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                    <SelectTrigger className={cn(form.formState.errors.type && "border-destructive")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Money In</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.type && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.type.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-category" className="text-right">Category</Label>
            <div className="col-span-3">
              <Input
                id="edit-category"
                {...form.register("category")}
                placeholder="Optional category"
                disabled={isLoading}
              />
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
              {form.formState.errors.date && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.date.message}</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 