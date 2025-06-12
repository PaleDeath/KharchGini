"use client";

import { useState, useMemo } from 'react';
import { PageHeader } from "@/components/page-header";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRecurringTransactions } from '@/hooks/use-firestore-data';
import { format, parseISO, isSameDay, isBefore } from 'date-fns';
import { CalendarIcon, AlertTriangle, Clock, CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

export default function BillsPage() {
  const { toast } = useToast();
  const { recurringTransactions, processRecurringTransactionsNow, refreshRecurringTransactions } = useRecurringTransactions();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const today = new Date();

  // Get bills for selected date
  const selectedDateBills = useMemo(() => {
    return recurringTransactions.filter(rt => {
      if (!rt.isActive) return false;
      const dueDate = parseISO(rt.nextDueDate);
      return isSameDay(dueDate, selectedDate);
    });
  }, [recurringTransactions, selectedDate]);

  // Get overdue bills
  const overdueBills = useMemo(() => {
    return recurringTransactions.filter(rt => {
      if (!rt.isActive) return false;
      const dueDate = parseISO(rt.nextDueDate);
      return isBefore(dueDate, today);
    });
  }, [recurringTransactions]);

  // Get bills due today
  const dueTodayBills = useMemo(() => {
    return recurringTransactions.filter(rt => {
      if (!rt.isActive) return false;
      const dueDate = parseISO(rt.nextDueDate);
      return isSameDay(dueDate, today);
    });
  }, [recurringTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getBillStatus = (bill: any) => {
    const dueDate = parseISO(bill.nextDueDate);
    if (isBefore(dueDate, today)) return 'overdue';
    if (isSameDay(dueDate, today)) return 'due';
    return 'upcoming';
  };

  const handleProcessBills = async () => {
    try {
      const count = await processRecurringTransactionsNow();
      if (count > 0) {
        refreshRecurringTransactions();
        toast({ 
          title: "Bills Processed", 
          description: `${count} bill${count !== 1 ? 's' : ''} processed.` 
        });
      } else {
        toast({ 
          title: "All Up to Date", 
          description: "No bills were due for processing." 
        });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to process bills." });
    }
  };

  return (
    <>
      <PageHeader
        title="Bills Calendar"
        description="Track your upcoming bills and recurring transactions."
        actions={
          <Button variant="outline" size="sm" onClick={handleProcessBills} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Process Due Bills
          </Button>
        }
      />

      {/* Overdue Alert */}
      {overdueBills.length > 0 && (
        <Alert className="mb-6 border-red-500 bg-red-50 dark:bg-red-900/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            <strong>{overdueBills.length} overdue bill{overdueBills.length !== 1 ? 's' : ''}</strong> need attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueBills.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(overdueBills.reduce((sum, bill) => sum + bill.amount, 0))}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Due Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{dueTodayBills.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(dueTodayBills.reduce((sum, bill) => sum + bill.amount, 0))}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Active Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {recurringTransactions.filter(rt => rt.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">recurring</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar and Bills */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="shadow-md lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Bills Calendar
            </CardTitle>
            <CardDescription>Click on a date to see bills due</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border w-full"
            />
          </CardContent>
        </Card>

        {/* Selected Date Bills */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">
              {format(selectedDate, 'MMM d, yyyy')}
            </CardTitle>
            <CardDescription>
              {selectedDateBills.length > 0 
                ? `${selectedDateBills.length} bill${selectedDateBills.length !== 1 ? 's' : ''} due`
                : 'No bills due'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedDateBills.length > 0 ? (
              selectedDateBills.map((bill) => {
                const status = getBillStatus(bill);
                return (
                  <div key={bill.id} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{bill.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {bill.frequency} • {bill.category || 'Uncategorized'}
                        </p>
                      </div>
                      <span className={cn(
                        "font-semibold text-sm",
                        bill.type === 'income' ? "text-emerald-600" : "text-red-600"
                      )}>
                        {bill.type === 'income' ? '+' : '-'}{formatCurrency(bill.amount)}
                      </span>
                    </div>
                    <Badge className={cn(
                      "text-xs",
                      status === 'overdue' && "bg-red-100 text-red-700 border-red-200",
                      status === 'due' && "bg-orange-100 text-orange-700 border-orange-200",
                      status === 'upcoming' && "bg-emerald-100 text-emerald-700 border-emerald-200"
                    )}>
                      {status === 'overdue' ? 'Overdue' : 
                       status === 'due' ? 'Due Today' : 'Upcoming'}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mb-2 mx-auto" />
                <p className="text-sm">No bills due on this date</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
} 