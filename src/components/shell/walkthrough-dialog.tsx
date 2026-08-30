'use client';

import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CalendarRange,
  CheckCircle2,
  PiggyBank,
  PlusCircle,
  Receipt,
  Sparkles,
  Sunrise,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Slide {
  id: string;
  badge: string;
  title: string;
  tagline: string;
  icon: typeof Sunrise;
  color: string;
  content: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    id: 'sts',
    badge: 'Core Philosophy',
    title: 'Safe to Spend',
    tagline: 'Know what you can spend today without touching committed money.',
    icon: Sunrise,
    color: '#6366f1',
    content: (
      <div className="space-y-3.5">
        <p className="text-sm text-muted leading-relaxed">
          Traditional finance apps show your total bank balance, which tricks you into overspending before rent or EMIs are due.
        </p>

        <div className="rounded-xl border border-line bg-raised/50 p-3.5 space-y-2.5 font-mono text-[13px]">
          <div className="flex justify-between items-center text-ink">
            <span>Spendable Cash</span>
            <span className="font-semibold text-good">₹65,000</span>
          </div>
          <div className="flex justify-between items-center text-bad/90">
            <span>− Committed Bills & EMIs</span>
            <span>−₹28,000</span>
          </div>
          <div className="flex justify-between items-center text-bad/90">
            <span>− Reserved Groceries/Needs</span>
            <span>−₹12,000</span>
          </div>
          <div className="h-px bg-line my-1" />
          <div className="flex justify-between items-center font-bold text-accent text-sm">
            <span>= Safe to Spend</span>
            <span>₹25,000</span>
          </div>
        </div>

        <p className="text-[12px] text-faint">
          Divided across days until your next payday, giving you an honest daily spending limit.
        </p>
      </div>
    ),
  },
  {
    id: 'entry',
    badge: 'Frictionless Logging',
    title: 'Type The Way You Speak',
    tagline: 'Log in seconds without navigating complicated forms.',
    icon: PlusCircle,
    color: '#22c55e',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted leading-relaxed">
          Press <kbd className="rounded border border-line bg-raised px-1.5 py-0.5 text-[11px] font-semibold text-ink">/</kbd> or tap <strong>+</strong> anywhere and type naturally:
        </p>

        <div className="space-y-2">
          <div className="rounded-lg border border-line bg-surface p-2.5 flex items-center justify-between">
            <code className="text-[13px] font-medium text-ink">350 lunch with team</code>
            <span className="text-[11px] text-muted rounded bg-raised px-2 py-0.5">Eating Out · ₹350</span>
          </div>
          <div className="rounded-lg border border-line bg-surface p-2.5 flex items-center justify-between">
            <code className="text-[13px] font-medium text-ink">1500 petrol icici</code>
            <span className="text-[11px] text-muted rounded bg-raised px-2 py-0.5">Fuel · ICICI · ₹1,500</span>
          </div>
          <div className="rounded-lg border border-line bg-surface p-2.5 flex items-center justify-between">
            <code className="text-[13px] font-medium text-ink">75000 salary</code>
            <span className="text-[11px] text-good rounded bg-good/10 px-2 py-0.5">Income · ₹75,000</span>
          </div>
        </div>

        <p className="text-[12px] text-faint">
          Amounts, accounts, categories, and dates are detected automatically as you type.
        </p>
      </div>
    ),
  },
  {
    id: 'plan',
    badge: 'Recurring & Budgets',
    title: 'Plan & Upcoming Bills',
    tagline: 'Never miss a due date or blow your monthly budget.',
    icon: CalendarRange,
    color: '#f59e0b',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted leading-relaxed">
          Set up regular commitments once in the <strong>Plan</strong> tab:
        </p>

        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-xl border border-line bg-surface p-3 space-y-1">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-accent" /> Fixed Bills
            </span>
            <p className="text-muted text-[11px]">
              Rent, EMIs, SIPs, Subscriptions. Automatically post on due dates without calendar drift.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3 space-y-1">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <PiggyBank className="h-3.5 w-3.5 text-good" /> Envelopes
            </span>
            <p className="text-muted text-[11px]">
              Monthly targets per category (Needs vs. Wants) with optional rollover.
            </p>
          </div>
        </div>

        <p className="text-[12px] text-faint">
          Variable bills (like electricity) stay in "Coming up" until you confirm the exact amount.
        </p>
      </div>
    ),
  },
  {
    id: 'custom',
    badge: 'Customization & Learning',
    title: 'Custom Categories & Memory',
    tagline: 'Your taxonomy, zero maintenance.',
    icon: Brain,
    color: '#ec4899',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted leading-relaxed">
          Need a special category like <strong>Home Loan EMI</strong>, <strong>Pets</strong>, or <strong>Side Project</strong>?
        </p>

        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <div className="flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div className="text-[12px]">
              <span className="font-medium text-ink">Smart Merchant Learning</span>
              <p className="text-muted mt-0.5">
                Whenever you change a transaction's category, KharchGini remembers that payee. Future transactions from that merchant auto-categorize instantly.
              </p>
            </div>
          </div>
        </div>

        <p className="text-[12px] text-faint">
          Manage accounts, custom categories, CSV imports, and data export anytime in the <strong>You</strong> tab.
        </p>
      </div>
    ),
  },
];

export function WalkthroughDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);

  const current = SLIDES[index] ?? SLIDES[0]!;
  const isFirst = index === 0;
  const isLast = index === SLIDES.length - 1;

  const next = () => {
    if (isLast) {
      onClose();
      setIndex(0);
    } else {
      setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
    }
  };

  const prev = () => {
    setIndex((i) => Math.max(0, i - 1));
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(val) => !val && onClose()}
      title={current.title}
      description={current.tagline}
      footer={
        <div className="flex w-full items-center justify-between">
          {!isFirst ? (
            <Button variant="ghost" size="sm" onClick={prev} className="gap-1.5 text-[13px]">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] text-muted hover:text-ink transition-colors px-2 py-1"
            >
              Skip guide
            </button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={next}
            className="gap-1.5 px-4 text-[13px]"
          >
            {isLast ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Got it, let&apos;s go
              </>
            ) : (
              <>
                Next <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Header Indicator */}
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: `${current.color}1a`, color: current.color }}
          >
            <current.icon className="h-3 w-3" />
            {current.badge}
          </span>
          <div className="flex items-center gap-1">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === index ? 'w-5 bg-accent' : 'w-1.5 bg-line hover:bg-muted'
                )}
              />
            ))}
          </div>
        </div>

        {/* Slide Content */}
        <div className="min-h-[220px] flex flex-col justify-center">
          {current.content}
        </div>
      </div>
    </Sheet>
  );
}
