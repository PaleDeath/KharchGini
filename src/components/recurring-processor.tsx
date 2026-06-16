'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { processRecurringTransactions } from '@/services/recurring';
import { useToast } from '@/hooks/use-toast';

export function RecurringProcessor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const processedRef = useRef(false);

  useEffect(() => {
    if (!user?.uid || processedRef.current) return;

    const checkRecurring = async () => {
      // optimization: check local storage to avoid excessive reads on page reload
      const today = new Date().toISOString().split('T')[0];
      const lastRun = localStorage.getItem(`recurring_last_run_${user.uid}`);

      if (lastRun === today) {
        return;
      }

      try {
        const count = await processRecurringTransactions(user.uid);
        if (count > 0) {
          toast({
            title: "Recurring Transactions Processed",
            description: `Generated ${count} new transaction${count !== 1 ? 's' : ''}.`
          });
        }
        localStorage.setItem(`recurring_last_run_${user.uid}`, today);
      } catch (error) {
        console.error("Failed to process recurring transactions:", error);
      } finally {
        processedRef.current = true;
      }
    };

    checkRecurring();
  }, [user?.uid, toast]);

  return null;
}
