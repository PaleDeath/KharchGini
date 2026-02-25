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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, PlusCircle, Loader2, Mic } from "lucide-react";
import { VoiceTransactionInput } from "@/components/voice-transaction-input";
import { VoiceTransactionData } from "@/lib/voice/speech-recognition";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/lib/types";
import { categorizeTransactionAction } from '@/actions/transaction-actions';
import { addTransaction } from '@/services/transactions';
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTab?: 'manual' | 'voice';
  initialData?: VoiceTransactionData | null;
}

export function AddTransactionDialog({
  onTransactionAdded,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultTab = 'manual',
  initialData
}: AddTransactionDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'voice'>(defaultTab);
  const { toast } = useToast();
  const { user } = useAuth();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

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

  // Handle initial data
  useEffect(() => {
    if (open && initialData) {
      if (initialData.amount) form.setValue('amount', initialData.amount);
      if (initialData.description) form.setValue('description', initialData.description);
      if (initialData.type) form.setValue('type', initialData.type);
      // We don't auto-set category here as the form doesn't have a category field exposed in the manual tab (it's auto-categorized on submit)
    }
  }, [open, initialData, form]);

  const handleVoiceTransaction = async (voiceData: VoiceTransactionData) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }

    // Pre-fill form with voice data
    if (voiceData.amount) form.setValue('amount', voiceData.amount);
    if (voiceData.description) form.setValue('description', voiceData.description);
    if (voiceData.type) form.setValue('type', voiceData.type);

    // Switch to manual tab for review/editing
    setActiveTab('manual');

    toast({
      title: "Voice Input Processed",
      description: "Please review and confirm the transaction details."
    });
  };

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
          const result = await categorizeTransactionAction(
            data.description,
            data.amount,
            data.date.toISOString()
          );
          if (result.success && result.category && result.confidence && result.confidence > 0.7) {
            category = result.category;
          }
        }
      } catch (error) {
        // Categorization failed, continue without category
        console.log('Auto-categorization failed:', error);
      }

      // Format date in local timezone to avoid timezone conversion issues
      const year = data.date.getFullYear();
      const month = String(data.date.getMonth() + 1).padStart(2, '0');
      const day = String(data.date.getDate()).padStart(2, '0');
      const localDateString = `${year}-${month}-${day}`;

      const transaction: Omit<Transaction, 'id'> = {
        ...data,
        date: localDateString, // Use local date formatting to avoid UTC conversion
        category: category || undefined
      };

      const newTransaction = await addTransaction(user.uid, transaction);
      onTransactionAdded(newTransaction);
      form.reset();
      setOpen(false);
      setActiveTab('manual'); // Reset to manual tab

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
      {!isControlled && (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Add Transaction
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Add a new transaction manually or use voice input for hands-free entry.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'manual' | 'voice')} className="w-full flex flex-col flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="voice" className="gap-2">
              <Mic className="h-4 w-4" />
              Voice Input
            </TabsTrigger>
          </TabsList>

          <TabsContent value="voice" className="mt-4 flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <VoiceTransactionInput
                onTransactionParsed={handleVoiceTransaction}
                onCancel={() => setActiveTab('manual')}
              />
            </div>
          </TabsContent>

          <TabsContent value="manual" className="mt-4 flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
