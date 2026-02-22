"use client";

import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, Tags, AlertTriangle } from "lucide-react";
import { bulkDeleteTransactions, bulkUpdateTransactionCategory } from '@/services/transactions';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { Alert, AlertDescription } from "@/components/ui/alert";
// Common categories for Indian context
const EXPENSE_CATEGORIES = [
  'Food & Dining', 'Transportation', 'Shopping', 'Bills & Utilities', 
  'Healthcare', 'Entertainment', 'Education', 'Travel & Vacation',
  'Insurance', 'Personal Care', 'Home & Garden', 'Gifts & Donations',
  'Professional Services', 'Miscellaneous'
];

const INCOME_CATEGORIES = [
  'Salary', 'Business Income', 'Investment Returns', 'Rental Income', 'Other Income'
];

const bulkCategoryFormSchema = z.object({
  category: z.string().min(1, "Please select a category."),
});

type BulkCategoryFormValues = z.infer<typeof bulkCategoryFormSchema>;

interface BulkActionsDialogProps {
  selectedIds: string[];
  onActionCompleted: () => void;
  children: React.ReactNode;
}

export function BulkActionsDialog({ selectedIds, onActionCompleted, children }: BulkActionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<'delete' | 'categorize' | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<BulkCategoryFormValues>({
    resolver: zodResolver(bulkCategoryFormSchema),
    defaultValues: {
      category: '',
    },
  });

  const allCategories = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].sort();

  const handleBulkDelete = async () => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }

    setIsLoading(true);
    try {
      await bulkDeleteTransactions(user.uid, selectedIds);
      toast({ 
        title: "Transactions Deleted", 
        description: `Successfully deleted ${selectedIds.length} transaction${selectedIds.length !== 1 ? 's' : ''}.` 
      });
      onActionCompleted();
      setOpen(false);
      setAction(null);
    } catch (error) {
      console.error("Error bulk deleting transactions:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete transactions." });
    } finally {
      setIsLoading(false);
    }
  };

  const onCategorySubmit = async (data: BulkCategoryFormValues) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }

    setIsLoading(true);
    try {
      await bulkUpdateTransactionCategory(user.uid, selectedIds, data.category);
      toast({ 
        title: "Categories Updated", 
        description: `Successfully updated ${selectedIds.length} transaction${selectedIds.length !== 1 ? 's' : ''} with category "${data.category}".` 
      });
      onActionCompleted();
      setOpen(false);
      setAction(null);
      form.reset();
    } catch (error) {
      console.error("Error bulk updating categories:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update transaction categories." });
    } finally {
      setIsLoading(false);
    }
  };

  const resetDialog = () => {
    setAction(null);
    form.reset();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetDialog();
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bulk Actions</DialogTitle>
          <DialogDescription>
            Perform actions on {selectedIds.length} selected transaction{selectedIds.length !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {!action && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setAction('categorize')}
                className="h-20 flex flex-col gap-2"
                disabled={isLoading}
              >
                <Tags className="h-6 w-6" />
                <span className="text-sm">Categorize</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setAction('delete')}
                className="h-20 flex flex-col gap-2 hover:bg-destructive hover:text-destructive-foreground"
                disabled={isLoading}
              >
                <Trash2 className="h-6 w-6" />
                <span className="text-sm">Delete</span>
              </Button>
            </div>
          )}

          {action === 'delete' && (
            <div className="space-y-4">
              <Alert className="border-destructive bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  This action cannot be undone. This will permanently delete {selectedIds.length} transaction{selectedIds.length !== 1 ? 's' : ''}.
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetDialog} disabled={isLoading} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleBulkDelete} 
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete {selectedIds.length} Transaction{selectedIds.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {action === 'categorize' && (
            <form onSubmit={form.handleSubmit(onCategorySubmit)} className="space-y-4">
              <div>
                <Label htmlFor="category">Select Category</Label>
                <Select onValueChange={(value) => form.setValue('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.category.message}</p>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={resetDialog} disabled={isLoading} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update {selectedIds.length} Transaction{selectedIds.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 