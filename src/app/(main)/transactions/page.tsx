
"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/page-header";
import { AddTransactionDialog } from "@/components/add-transaction-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Edit, Tags, Loader2 } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { categorizeTransactionAction, deleteTransactionAction } from '@/actions/transaction-actions';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
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
import { cn } from "@/lib/utils";


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]); // Initialize with empty array
  const [isCategorizing, setIsCategorizing] = useState<string | null>(null);
  const { toast } = useToast();

  const handleTransactionAdded = (newTransaction: Transaction) => {
    setTransactions(prev => [newTransaction, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    toast({ title: "Transaction Added", description: "Your transaction has been recorded."});
  };

  const handleCategorize = async (transaction: Transaction) => {
    if (!transaction.description) {
      toast({ variant: "destructive", title: "Error", description: "Transaction description is empty." });
      return;
    }
    setIsCategorizing(transaction.id);
    try {
        const result = await categorizeTransactionAction(transaction.id, transaction.description);
        if (result.success && result.category) {
        setTransactions(prev => prev.map(t => t.id === transaction.id ? { ...t, category: result.category } : t));
        toast({ title: "Success", description: `Transaction categorized as ${result.category}.` });
        } else {
        toast({ variant: "destructive", title: "Error", description: result.error || "Failed to categorize transaction." });
        }
    } catch (error) {
         toast({ variant: "destructive", title: "AI Categorization Error", description: "Could not connect to AI service." });
    } finally {
        setIsCategorizing(null);
    }
  };

  const handleDelete = async (transactionId: string) => {
    const result = await deleteTransactionAction(transactionId); 
    if (result.success) {
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      toast({ title: "Success", description: "Transaction deleted." });
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error || "Failed to delete transaction." });
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Manage and categorize your financial transactions."
        actions={<AddTransactionDialog onTransactionAdded={handleTransactionAdded} />}
      />
      <Card className="shadow-md">
        <CardContent className="p-0">
          <Table>
            {transactions.length === 0 && <TableCaption className="py-4">No transactions found. Add one to get started!</TableCaption>}
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}</TableCell>
                  <TableCell className="font-medium">{transaction.description}</TableCell>
                  <TableCell className={transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                           className={cn(
                            'font-semibold text-xs px-2 py-0.5', // adjusted padding and text size
                            transaction.type === 'income' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-700/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600' 
                              : 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-300 dark:border-red-600'
                           )}
                    >
                      {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{transaction.category || <span className="text-muted-foreground italic">Uncategorized</span>}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast({title: "Coming Soon!", description:"Editing transactions will be available in a future update."})}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCategorize(transaction)} disabled={isCategorizing === transaction.id || !transaction.description}>
                          {isCategorizing === transaction.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tags className="mr-2 h-4 w-4" />}
                          AI Categorize
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem 
                              onSelect={(e) => e.preventDefault()} 
                              className="text-destructive focus:text-destructive focus:bg-destructive/10 dark:focus:bg-destructive dark:focus:text-destructive-foreground"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete this transaction.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(transaction.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
