"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from "@/components/page-header";
import { AddRecurringTransactionDialog } from "@/components/add-recurring-transaction-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { RecurringTransaction } from "@/lib/types";
import { deleteRecurringTransaction, updateRecurringTransaction } from '@/services/recurring';
import { useToast } from "@/hooks/use-toast";
import { Repeat, Edit, Trash2, Calendar, Clock, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useRecurringTransactions } from '@/hooks/use-firestore-data';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export default function RecurringTransactionsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { 
    recurringTransactions, 
    loading, 
    error, 
    refreshRecurringTransactions, 
    processRecurringTransactionsNow 
  } = useRecurringTransactions();
  const [processedCount, setProcessedCount] = useState<number | null>(null);

  const handleRecurringTransactionAdded = (newRecurringTransaction: RecurringTransaction) => {
    refreshRecurringTransactions();
    toast({ 
      title: "Recurring Transaction Created", 
      description: `'${newRecurringTransaction.description}' has been set up successfully.`
    });
  };

  const handleDeleteRecurringTransaction = async (recurringTransactionId: string, description: string) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }
    try {
      await deleteRecurringTransaction(user.uid, recurringTransactionId);
      refreshRecurringTransactions();
      toast({ title: "Success", description: `Recurring transaction '${description}' deleted.` });
    } catch (error) {
      console.error("Error deleting recurring transaction:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete recurring transaction." });
    }
  };

  const handleToggleActive = async (recurringTransaction: RecurringTransaction) => {
    if (!user?.uid) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }
    try {
      await updateRecurringTransaction(user.uid, recurringTransaction.id, {
        isActive: !recurringTransaction.isActive
      });
      refreshRecurringTransactions();
      toast({ 
        title: "Status Updated", 
        description: `Recurring transaction '${recurringTransaction.description}' ${!recurringTransaction.isActive ? 'activated' : 'deactivated'}.` 
      });
    } catch (error) {
      console.error("Error updating recurring transaction:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update recurring transaction." });
    }
  };

  const handleProcessRecurring = async () => {
    try {
      const count = await processRecurringTransactionsNow();
      setProcessedCount(count);
      if (count > 0) {
        toast({ 
          title: "Transactions Created", 
          description: `${count} new transaction${count !== 1 ? 's' : ''} created from recurring transactions.` 
        });
        // Refresh to show updated data
        refreshRecurringTransactions();
      } else {
        toast({ 
          title: "All Up to Date", 
          description: "No recurring transactions were due for processing." 
        });
      }
    } catch (error) {
      console.error("Error processing recurring transactions:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to process recurring transactions." });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      yearly: "Yearly"
    };
    return labels[frequency] || frequency;
  };

  const getStatusInfo = (recurringTransaction: RecurringTransaction) => {
    if (!recurringTransaction.isActive) {
      return { 
        status: 'inactive', 
        color: 'secondary', 
        icon: XCircle, 
        label: 'Inactive',
        description: 'This recurring transaction is paused'
      };
    }
    
    const today = new Date().toISOString().split('T')[0];
    const nextDue = recurringTransaction.nextDueDate;
    
    if (nextDue <= today) {
      return { 
        status: 'due', 
        color: 'destructive', 
        icon: AlertTriangle, 
        label: 'Due Now',
        description: 'Ready to create transaction'
      };
    }
    
    return { 
      status: 'active', 
      color: 'default', 
      icon: CheckCircle2, 
      label: 'Active',
      description: `Next: ${format(parseISO(nextDue), 'MMM d, yyyy')}`
    };
  };

  const dueRecurringTransactions = recurringTransactions.filter(rt => {
    const today = new Date().toISOString().split('T')[0];
    return rt.isActive && rt.nextDueDate <= today;
  });

  return (
    <>
      <PageHeader
        title="Recurring Transactions"
        description="Set up and manage transactions that repeat automatically - perfect for salaries, bills, and subscriptions."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleProcessRecurring} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Process Due
            </Button>
            <AddRecurringTransactionDialog onRecurringTransactionAdded={handleRecurringTransactionAdded} />
          </div>
        }
      />

      {/* Alert for due transactions */}
      {dueRecurringTransactions.length > 0 && (
        <Alert className="mb-6 border-orange-500 bg-orange-50 dark:bg-orange-900/20">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <strong>{dueRecurringTransactions.length} recurring transaction{dueRecurringTransactions.length !== 1 ? 's are' : ' is'} due</strong> and ready to be processed. 
            Click &quot;Process Due&quot; to create the transactions automatically.
          </AlertDescription>
        </Alert>
      )}

      {/* Show processed count result */}
      {processedCount !== null && (
        <Alert className="mb-6 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800 dark:text-emerald-200">
            {processedCount > 0 
              ? `Successfully created ${processedCount} new transaction${processedCount !== 1 ? 's' : ''} from recurring transactions.`
              : "All recurring transactions are up to date. No new transactions were created."
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Recurring Transactions List */}
      {recurringTransactions.length === 0 ? (
        <Card className="shadow-md text-center py-10">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Repeat className="mx-auto h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle>No Recurring Transactions</CardTitle>
            <CardDescription>
              Save time by setting up transactions that repeat automatically. Perfect for rent, salary, subscriptions, and bills.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddRecurringTransactionDialog onRecurringTransactionAdded={handleRecurringTransactionAdded} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          {recurringTransactions.map((recurringTransaction) => {
            const statusInfo = getStatusInfo(recurringTransaction);
            const StatusIcon = statusInfo.icon;

            return (
              <Card key={recurringTransaction.id} className={cn(
                "shadow-md transition-colors",
                statusInfo.status === 'due' && "border-orange-500 bg-orange-50 dark:bg-orange-900/10",
                !recurringTransaction.isActive && "opacity-75"
              )}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <StatusIcon className={cn(
                          "h-5 w-5",
                          statusInfo.status === 'due' && "text-orange-500",
                          statusInfo.status === 'active' && "text-emerald-500",
                          statusInfo.status === 'inactive' && "text-muted-foreground"
                        )} />
                        {recurringTransaction.description}
                      </CardTitle>
                      <CardDescription>
                        {getFrequencyLabel(recurringTransaction.frequency)} • {formatCurrency(recurringTransaction.amount)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={recurringTransaction.isActive}
                        onCheckedChange={() => handleToggleActive(recurringTransaction)}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Recurring Transaction: {recurringTransaction.description}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete this recurring transaction. 
                              Future automatic transactions will not be created.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteRecurringTransaction(recurringTransaction.id, recurringTransaction.description)} 
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={statusInfo.color as any}>
                      {statusInfo.label}
                    </Badge>
                    <Badge variant={
                      recurringTransaction.type === 'income' ? 'default' : 'secondary'
                    } className={cn(
                      recurringTransaction.type === 'income' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-700/30 dark:text-emerald-300' 
                        : 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300'
                    )}>
                      {recurringTransaction.type.charAt(0).toUpperCase() + recurringTransaction.type.slice(1)}
                    </Badge>
                  </div>
                  
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span>{recurringTransaction.category || 'Uncategorized'}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Started:</span>
                      <span>{format(parseISO(recurringTransaction.startDate), 'MMM d, yyyy')}</span>
                    </div>
                    
                    {recurringTransaction.endDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ends:</span>
                        <span>{format(parseISO(recurringTransaction.endDate), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Next Due:</span>
                      <span className={cn(
                        statusInfo.status === 'due' && "text-orange-600 font-medium"
                      )}>
                        {format(parseISO(recurringTransaction.nextDueDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    
                    {recurringTransaction.lastExecuted && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Created:</span>
                        <span>{format(parseISO(recurringTransaction.lastExecuted), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    {statusInfo.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
} 