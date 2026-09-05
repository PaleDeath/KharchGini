'use client';

import { useMemo, useState } from 'react';
import { Banknote, Check, ChevronRight, CircleDashed, CreditCard, Landmark, Wallet } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { Account, AccountType } from '@/domain/types';
import { isAddOnCard } from '@/domain/types';

export function getAccountIcon(type: AccountType) {
  switch (type) {
    case 'card':
      return <CreditCard className="h-5 w-5 text-orange-500" />;
    case 'cash':
      return <Banknote className="h-5 w-5 text-emerald-500" />;
    case 'wallet':
      return <Wallet className="h-5 w-5 text-blue-500" />;
    case 'savings':
      return <Landmark className="h-5 w-5 text-teal-500" />;
    case 'bank':
    default:
      return <Landmark className="h-5 w-5 text-accent" />;
  }
}

export function getAccountBadgeColor(type: AccountType) {
  switch (type) {
    case 'card':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'cash':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'wallet':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'savings':
      return 'bg-teal-500/10 text-teal-500 border-teal-500/20';
    case 'bank':
    default:
      return 'bg-accent/10 text-accent border-accent/20';
  }
}

export interface AccountPickerProps {
  value: string;
  onChange: (accountId: string) => void;
  accounts: Account[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AccountPicker({
  value,
  onChange,
  accounts,
  placeholder = 'Select an account…',
  disabled = false,
  className,
}: AccountPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === value),
    [accounts, value],
  );

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'group relative flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface/90 p-2.5 sm:p-3 text-left transition-all duration-200 shadow-xs hover:border-accent/40 hover:bg-raised/40 active:scale-[0.99]',
          open && 'border-accent ring-2 ring-accent/15',
          disabled && 'opacity-60 cursor-not-allowed',
          className,
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selectedAccount ? (
            <>
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                  getAccountBadgeColor(selectedAccount.type),
                )}
              >
                {getAccountIcon(selectedAccount.type)}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {selectedAccount.name}
                </span>
                <span className="block text-[11px] font-medium uppercase tracking-wider text-faint">
                  {selectedAccount.type === 'card'
                    ? isAddOnCard(selectedAccount)
                      ? selectedAccount.last4 ? `Add-on Card (•••• ${selectedAccount.last4})` : 'Add-on Card'
                      : selectedAccount.last4 ? `Credit Card (•••• ${selectedAccount.last4})` : 'Credit Card'
                    : selectedAccount.type === 'cash'
                    ? 'Cash'
                    : selectedAccount.type === 'wallet'
                    ? 'Wallet'
                    : selectedAccount.type === 'savings'
                    ? 'Savings'
                    : 'Bank'}
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-line bg-raised/50 text-faint">
                <CircleDashed className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-muted">{placeholder}</span>
                <span className="block text-[11px] text-faint">Tap to select account</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded-lg bg-raised px-2 py-1 text-[11px] font-medium text-muted group-hover:text-ink transition-colors">
            {selectedAccount ? 'Change' : 'Choose'}
          </span>
          <ChevronRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" />
        </div>
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Select Account"
        description="Choose which account to deduct from or fund with"
      >
        <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar pb-2">
          {accounts.map((account) => {
            const isSelected = account.id === value;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => handleSelect(account.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-150 active:scale-[0.98]',
                  isSelected
                    ? 'border-accent bg-accent/12 shadow-xs ring-1.5 ring-accent/40'
                    : 'border-line/70 bg-surface/70 hover:border-line hover:bg-raised/80',
                )}
              >
                <span
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
                    getAccountBadgeColor(account.type),
                  )}
                >
                  {getAccountIcon(account.type)}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{account.name}</span>
                  <span className="block text-[11px] text-faint uppercase tracking-wider">
                    {account.type === 'card'
                      ? isAddOnCard(account)
                        ? account.last4 ? `Add-on Card (•••• ${account.last4})` : 'Add-on Card'
                        : account.last4 ? `Credit Card (•••• ${account.last4})` : 'Credit Card'
                      : account.type === 'cash'
                      ? 'Cash'
                      : account.type === 'wallet'
                      ? 'Wallet'
                      : account.type === 'savings'
                      ? 'Savings'
                      : 'Bank Account'}
                  </span>
                </div>
                {isSelected && <Check className="h-4 w-4 text-accent shrink-0" />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
