"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRecurringTransactions } from '@/hooks/use-firestore-data';
import { format, parseISO, isSameDay, isBefore, addDays } from 'date-fns';
import { Calendar, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface UpcomingBill {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  dueDate: string;
  status: 'overdue' | 'due' | 'upcoming';
  category?: string;
}

export function BillsCalendarWidget() {
  const { recurringTransactions } = useRecurringTransactions();

  const upcomingBills = useMemo(() => {
    const today = new Date();
    const nextWeek = addDays(today, 7);
    
    const bills: UpcomingBill[] = recurringTransactions
      .filter(rt => rt.isActive)
      .map(rt => {
        const dueDate = parseISO(rt.nextDueDate);
        let status: 'overdue' | 'due' | 'upcoming' = 'upcoming';
        
        if (isBefore(dueDate, today)) status = 'overdue';
        else if (isSameDay(dueDate, today)) status = 'due';
        
        return {
          id: rt.id,
          description: rt.description,
          amount: rt.amount,
          type: rt.type,
          dueDate: rt.nextDueDate,
          status,
          category: rt.category
        };
      })
      .filter(bill => {
        const dueDate = parseISO(bill.dueDate);
        return isBefore(dueDate, nextWeek) || isSameDay(dueDate, nextWeek);
      })
      .sort((a, b) => {
        // Sort by status priority (overdue > due > upcoming) then by date
        const statusPriority = { overdue: 0, due: 1, upcoming: 2 };
        if (statusPriority[a.status] !== statusPriority[b.status]) {
          return statusPriority[a.status] - statusPriority[b.status];
        }
        return a.dueDate.localeCompare(b.dueDate);
      });
    
    return bills.slice(0, 5); // Show only top 5
  }, [recurringTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getStatusIcon = (status: 'overdue' | 'due' | 'upcoming') => {
    switch (status) {
      case 'overdue': return AlertTriangle;
      case 'due': return Clock;
      case 'upcoming': return CheckCircle2;
    }
  };

  const getStatusColor = (status: 'overdue' | 'due' | 'upcoming') => {
    switch (status) {
      case 'overdue': return 'text-red-600 bg-red-50 border-red-200';
      case 'due': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'upcoming': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    }
  };

  const getDueDateText = (bill: UpcomingBill) => {
    const dueDate = parseISO(bill.dueDate);
    const today = new Date();
    
    if (bill.status === 'overdue') return 'Overdue';
    if (bill.status === 'due') return 'Due Today';
    
    const days = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `In ${days} days`;
    
    return format(dueDate, 'MMM d');
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Bills
          </CardTitle>
          <Button variant="outline" size="sm" asChild className="text-xs">
            <Link href="/bills">View Calendar</Link>
          </Button>
        </div>
        <CardDescription className="text-sm">
          Bills due in the next 7 days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 h-[250px] sm:h-[300px] overflow-y-auto">
        {upcomingBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 sm:h-12 sm:w-12 mb-2 text-emerald-500" />
            <p className="text-sm">No bills due this week!</p>
            <p className="text-xs">You&apos;re all caught up</p>
          </div>
        ) : (
          upcomingBills.map((bill) => {
            const StatusIcon = getStatusIcon(bill.status);
            return (
              <div key={bill.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIcon className={cn(
                        "h-4 w-4",
                        bill.status === 'overdue' && "text-red-500",
                        bill.status === 'due' && "text-orange-500",
                        bill.status === 'upcoming' && "text-emerald-500"
                      )} />
                      <p className="font-medium text-sm truncate">{bill.description}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {bill.category || 'Uncategorized'} • {getDueDateText(bill)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "font-semibold text-sm",
                      bill.type === 'income' ? "text-emerald-600" : "text-red-600"
                    )}>
                      {bill.type === 'income' ? '+' : '-'}{formatCurrency(bill.amount)}
                    </span>
                  </div>
                </div>
                <Badge className={cn("text-xs", getStatusColor(bill.status))}>
                  {bill.status === 'overdue' ? 'Overdue' : 
                   bill.status === 'due' ? 'Due Today' : 'Upcoming'}
                </Badge>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
} 