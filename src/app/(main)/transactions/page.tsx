"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/page-header";
import { AddTransactionDialog } from "@/components/add-transaction-dialog";
import { AddRecurringTransactionDialog } from "@/components/add-recurring-transaction-dialog";
import { EditTransactionDialog } from "@/components/edit-transaction-dialog";
import { CategoryReference } from "@/components/category-reference";
import { BulkActionsDialog } from "@/components/bulk-actions-dialog";
import { TransactionFiltersComponent, type TransactionFilters, type TransactionSort } from "@/components/transaction-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Edit, Tags, Loader2, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Plus, Wand2, Sparkles } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { categorizeTransactionAction, bulkCategorizeUncategorizedAction } from '@/actions/transaction-actions';
import { updateTransaction, deleteTransaction } from '@/lib/firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import { useTransactions } from '@/hooks/use-firestore-data';
import { useAuth } from '@/contexts/auth-context';
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
import { processTransactions, getTransactionStats } from "@/lib/transaction-utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


export default function TransactionsPage() {
  const [isCategorizing, setIsCategorizing] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const { transactions, loading, error, refreshTransactions } = useTransactions();
  const [isBulkCategorizing, setIsBulkCategorizing] = useState(false);

  // Filtering and sorting state
  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    type: 'all',
    category: ''
  });
  const [sort, setSort] = useState<TransactionSort>({
    field: 'date',
    order: 'desc'
  });

  // Apply filters and sorting
  const processedTransactions = useMemo(() => {
    return processTransactions(transactions, filters, sort);
  }, [transactions, filters, sort]);

  // Get stats for the filtered transactions
  const stats = useMemo(() => {
    return getTransactionStats(processedTransactions);
  }, [processedTransactions]);

  const handleTransactionAdded = (newTransaction: Transaction) => {
    // Refresh transactions from Firestore to get the latest data
    refreshTransactions();
    toast({ title: "Transaction Added", description: "Your transaction has been recorded."});
  };

  const handleTransactionUpdated = (updatedTransaction: Transaction) => {
    // Refresh transactions from Firestore to get the latest data
    refreshTransactions();
  };

  // Bulk selection handlers
  const handleSelectTransaction = (transactionId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, transactionId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== transactionId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(processedTransactions.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleBulkActionCompleted = () => {
    setSelectedIds([]);
    refreshTransactions();
  };

  const isAllSelected = processedTransactions.length > 0 && selectedIds.length === processedTransactions.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < processedTransactions.length;

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [filters, sort]);

  const handleCategorize = async (transaction: Transaction) => {
    if (!transaction.description || !user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "Transaction description is empty or user not logged in." });
      return;
    }
    setIsCategorizing(transaction.id);
    try {
        const result = await categorizeTransactionAction(transaction.description);
        if (result.success && result.category) {
          // Update the transaction in Firestore
          await updateTransaction(user.uid, transaction.id, { category: result.category });
          // Refresh transactions to get updated data from Firestore
          refreshTransactions();
          
          const confidenceText = result.confidence 
            ? ` (${Math.round(result.confidence * 100)}% confidence)`
            : '';
          toast({ 
            title: "AI Categorization Complete", 
            description: `Categorized as "${result.category}"${confidenceText}` 
          });
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
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }
    try {
      await deleteTransaction(user.uid, transactionId); 
      // Refresh transactions to get updated data from Firestore
      refreshTransactions();
      toast({ title: "Success", description: "Transaction deleted." });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete transaction." });
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const getSortIcon = (field: string) => {
    if (sort.field !== field) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    }
    return sort.order === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-primary" />
      : <ArrowDown className="h-4 w-4 text-primary" />;
  };

  const handleHeaderSort = (field: any) => {
    if (sort.field === field) {
      setSort({
        field,
        order: sort.order === 'asc' ? 'desc' : 'asc'
      });
    } else {
      setSort({
        field,
        order: field === 'date' ? 'desc' : 'asc'
      });
    }
  };

  const handleBulkCategorize = async () => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in." });
      return;
    }

    setIsBulkCategorizing(true);
    try {
      const result = await bulkCategorizeUncategorizedAction(user.uid);
      if (result.success) {
        if (result.categorizedCount && result.categorizedCount > 0) {
          toast({
            title: "Bulk Categorization Complete",
            description: `Successfully categorized ${result.categorizedCount} transaction(s).`
          });
          refreshTransactions();
        } else {
          toast({
            title: "No Transactions to Categorize",
            description: "All your transactions already have a category."
          });
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error || "Failed to categorize transactions." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred during bulk categorization." });
    } finally {
      setIsBulkCategorizing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        description={`Manage and categorize your financial transactions. ${stats.total > 0 ? `Showing ${stats.total} of ${transactions.length} transactions.` : ''}`}
        actions={
          <div className="flex gap-2 flex-wrap">
            {selectedIds.length > 0 && (
              <BulkActionsDialog 
                selectedIds={selectedIds} 
                onActionCompleted={handleBulkActionCompleted}
              >
                <Button variant="outline" className="gap-2">
                  <CheckSquare className="h-4 w-4" />
                  {selectedIds.length} Selected
                </Button>
              </BulkActionsDialog>
            )}
            <CategoryReference />
            <AddRecurringTransactionDialog onRecurringTransactionAdded={(newRecurring) => {
              toast({ 
                title: "Recurring Transaction Added", 
                description: `'${newRecurring.description}' will now repeat ${newRecurring.frequency}ly.` 
              });
            }} />
            <AddTransactionDialog onTransactionAdded={handleTransactionAdded} />
            <Button variant="outline" size="sm" onClick={handleBulkCategorize} disabled={isBulkCategorizing || loading}>
              {isBulkCategorizing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              AI Categorize
            </Button>
          </div>
        }
      />
      
      {/* Filters and Search */}
      <div className="mb-6">
        <TransactionFiltersComponent
          transactions={transactions}
          filters={filters}
          sort={sort}
          onFiltersChange={setFilters}
          onSortChange={setSort}
        />
      </div>

      {/* Results summary */}
      {(filters.search || filters.type !== 'all' || filters.category) && (
        <div className="mb-4">
          <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
            {stats.total === 0 ? (
              "No transactions match your filters."
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
                <span>
                  Found <strong>{stats.total}</strong> transaction{stats.total !== 1 ? 's' : ''}
                  {stats.income > 0 && ` (${stats.income} money in)`}
                  {stats.expense > 0 && ` (${stats.expense} expense${stats.expense !== 1 ? 's' : ''})`}
                </span>
                {stats.totalIncome > 0 || stats.totalExpenses > 0 && (
                  <span className="sm:ml-2">
                    <span className="hidden sm:inline"> · </span>Net: <strong className={stats.netAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {formatCurrency(Math.abs(stats.netAmount))} {stats.netAmount >= 0 ? 'surplus' : 'deficit'}
                    </strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <Card className="shadow-md hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
            {processedTransactions.length === 0 && transactions.length === 0 && <TableCaption className="py-4">No transactions found. Add one to get started!</TableCaption>}
            {processedTransactions.length === 0 && transactions.length > 0 && <TableCaption className="py-4">No transactions match your current filters.</TableCaption>}
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all transactions"
                    className={isIndeterminate ? "data-[state=checked]:bg-orange-500" : ""}
                  />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none whitespace-nowrap"
                  onClick={() => handleHeaderSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {getSortIcon('date')}
                  </div>
                </TableHead>
                <TableHead className="min-w-[150px]">
                  Description
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none whitespace-nowrap"
                  onClick={() => handleHeaderSort('amount')}
                >
                  <div className="flex items-center gap-1">
                    Amount
                    {getSortIcon('amount')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none whitespace-nowrap"
                  onClick={() => handleHeaderSort('type')}
                >
                  <div className="flex items-center gap-1">
                    Type
                    {getSortIcon('type')}
                  </div>
                </TableHead>
                <TableHead className="min-w-[120px]">
                  Category
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedTransactions.length === 0 && transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    {loading ? (
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                        <span>Loading transactions...</span>
                      </div>
                    ) : (
                      "No transactions found."
                    )}
                  </TableCell>
                </TableRow>
              )}
              {processedTransactions.length === 0 && transactions.length > 0 && (
                processedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(transaction.id)}
                        onCheckedChange={(checked) => handleSelectTransaction(transaction.id, !!checked)}
                        aria-label={`Select transaction ${transaction.description}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={transaction.description}>{transaction.description}</TableCell>
                    <TableCell className={cn(
                      'whitespace-nowrap font-medium',
                      transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                             className={cn(
                              'font-semibold text-xs px-2 py-0.5 whitespace-nowrap',
                              transaction.type === 'income' 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-700/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600' 
                                : 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-300 dark:border-red-600'
                             )}
                      >
                        {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate" title={transaction.category || 'Uncategorized'}>{transaction.category || <span className="text-muted-foreground italic">Uncategorized</span>}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <EditTransactionDialog 
                            transaction={transaction} 
                            onTransactionUpdated={handleTransactionUpdated}
                          >
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                              <Edit className="mr-2 h-4 w-4" /> 
                              <span>Edit Transaction</span>
                            </DropdownMenuItem>
                          </EditTransactionDialog>
                          <DropdownMenuItem 
                            onClick={() => handleCategorize(transaction)} 
                            disabled={isCategorizing === transaction.id || !transaction.description}
                            className="cursor-pointer"
                          >
                            {isCategorizing === transaction.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tags className="mr-2 h-4 w-4" />}
                            <span>AI Categorize</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                onSelect={(e) => e.preventDefault()} 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10 dark:focus:bg-destructive dark:focus:text-destructive-foreground cursor-pointer"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> 
                                <span>Delete Transaction</span>
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
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {processedTransactions.length === 0 && transactions.length === 0 && (
          <Card className="shadow-md">
            <CardContent className="py-8 text-center text-muted-foreground">
              No transactions found. Add one to get started!
            </CardContent>
          </Card>
        )}
        {processedTransactions.length === 0 && transactions.length > 0 && (
          <Card className="shadow-md">
            <CardContent className="py-8 text-center text-muted-foreground">
              No transactions match your current filters.
            </CardContent>
          </Card>
        )}
        {processedTransactions.map((transaction) => (
          <Card key={transaction.id} className={cn("shadow-md", selectedIds.includes(transaction.id) && "ring-2 ring-primary")}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Checkbox
                    checked={selectedIds.includes(transaction.id)}
                    onCheckedChange={(checked) => handleSelectTransaction(transaction.id, !!checked)}
                    aria-label={`Select transaction ${transaction.description}`}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">{transaction.description}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 shrink-0 hover:bg-muted">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <EditTransactionDialog 
                      transaction={transaction} 
                      onTransactionUpdated={handleTransactionUpdated}
                    >
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                        <Edit className="mr-2 h-4 w-4" /> 
                        <span>Edit Transaction</span>
                      </DropdownMenuItem>
                    </EditTransactionDialog>
                    <DropdownMenuItem 
                      onClick={() => handleCategorize(transaction)} 
                      disabled={isCategorizing === transaction.id || !transaction.description}
                      className="cursor-pointer"
                    >
                      {isCategorizing === transaction.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tags className="mr-2 h-4 w-4" />}
                      <span>AI Categorize</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem 
                          onSelect={(e) => e.preventDefault()} 
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 dark:focus:bg-destructive dark:focus:text-destructive-foreground cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> 
                          <span>Delete Transaction</span>
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
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge 
                    className={cn(
                      'font-semibold text-xs px-2 py-1',
                      transaction.type === 'income' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-700/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600' 
                        : 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-300 dark:border-red-600'
                    )}
                  >
                    {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                  </Badge>
                  {transaction.category && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {transaction.category}
                    </span>
                  )}
                </div>
                <div className={cn(
                  'font-semibold text-right',
                  transaction.type === 'income' 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-red-600 dark:text-red-400'
                )}>
                  {formatCurrency(transaction.amount)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
