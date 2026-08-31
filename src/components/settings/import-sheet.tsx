'use client';

import { Banknote, CreditCard, FileUp, Landmark, TriangleAlert } from 'lucide-react';
import Papa from 'papaparse';
import { useMemo, useRef, useState } from 'react';

import { isValidISODate, type ISODate } from '@/domain/dates';
import { guessCategory } from '@/domain/categorize';
import { formatMoney, parseAmount } from '@/domain/money';
import type { Direction, EntryDraft, Ledger } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { CustomSelect } from '@/components/ui/custom-select';
import { Field } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';

type Row = Record<string, string>;

interface Mapping {
  date: string;
  description: string;
  amount: string;
  debit: string;
  credit: string;
}

const NONE = '';

/**
 * Getting a spreadsheet in.
 *
 * The point of this screen is that leaving Excel should cost one afternoon, not
 * a decision to abandon four years of history. Bank exports are messy in a small
 * number of predictable ways — separate debit and credit columns, dates written
 * the Indian way — and handling exactly those covers almost everything a person
 * will actually paste in here.
 */
export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ledger, addEntries } = useLedger();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [map, setMap] = useState<Mapping>({
    date: NONE,
    description: NONE,
    amount: NONE,
    debit: NONE,
    credit: NONE,
  });
  const [accountId, setAccountId] = useState(ledger.accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  const accounts = ledger.accounts.filter((a) => !a.archived);

  const pick = async (file: File) => {
    const text = await file.text();
    const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: 'greedy' });
    const detected = parsed.meta.fields ?? [];

    setFileName(file.name);
    setFields(detected);
    setRows(parsed.data);
    setMap({
      date: guessField(detected, ['date']),
      description: guessField(detected, [
        'narration',
        'particular',
        'description',
        'details',
        'remark',
        'merchant',
        'name',
      ]),
      amount: guessField(detected, ['amount', 'value']),
      debit: guessField(detected, ['debit', 'withdrawal']),
      credit: guessField(detected, ['credit', 'deposit']),
    });
  };

  const drafts = useMemo(
    () => (accountId ? buildDrafts(rows, map, accountId, ledger) : []),
    [rows, map, accountId, ledger],
  );

  const skipped = rows.length - drafts.length;

  const run = async () => {
    if (drafts.length === 0) return;
    setBusy(true);
    try {
      await addEntries(drafts);
      toast(`${drafts.length} entries imported.`, { tone: 'good' });
      reset();
      onClose();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Import failed.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const accountOptions = useMemo(
    () =>
      accounts.map((acc) => ({
        value: acc.id,
        label: acc.name,
        icon:
          acc.type === 'card' ? (
            <CreditCard className="h-4 w-4 text-orange-500" />
          ) : acc.type === 'cash' ? (
            <Banknote className="h-4 w-4 text-emerald-500" />
          ) : (
            <Landmark className="h-4 w-4 text-accent" />
          ),
      })),
    [accounts],
  );

  const reset = () => {
    setFileName('');
    setFields([]);
    setRows([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const column = (label: string, key: keyof Mapping, hint?: string) => {
    const options = [
      { value: NONE, label: 'Not in this file' },
      ...fields.map((field) => ({ value: field, label: field })),
    ];
    return (
      <Field label={label} hint={hint}>
        <CustomSelect
          value={map[key]}
          onChange={(val) => setMap((current) => ({ ...current, [key]: val }))}
          options={options}
        />
      </Field>
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          onClose();
        }
      }}
      title="Import a spreadsheet"
      description="CSV. Your bank's export, or whatever you were keeping in Excel."
      wide
      footer={
        <Button
          variant="primary"
          onClick={run}
          disabled={busy || drafts.length === 0}
          className="w-full"
        >
          {drafts.length > 0 ? `Import ${drafts.length} entries` : 'Nothing to import yet'}
        </Button>
      }
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-card border border-dashed border-line px-4 py-4 transition-colors hover:border-accent">
          <FileUp className="h-5 w-5 shrink-0 text-faint" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-ink">
              {fileName || 'Choose a CSV file'}
            </span>
            <span className="block text-[12px] text-faint">
              {rows.length > 0
                ? `${rows.length} rows, ${fields.length} columns`
                : 'Nothing leaves your device until you press import.'}
            </span>
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pick(file);
            }}
          />
        </label>

        {fields.length > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {column('Date column', 'date', 'Day first: 05/03 is the 5th of March.')}
              {column('Description column', 'description')}
              {column('Amount column', 'amount', 'A single column with a sign.')}
              {column('Debit column', 'debit', 'If money out has its own column.')}
              {column('Credit column', 'credit', 'If money in has its own column.')}
              <Field label="Goes into account">
                <CustomSelect
                  value={accountId}
                  onChange={setAccountId}
                  options={accountOptions}
                  placeholder="Choose an account…"
                />
              </Field>
            </div>

            {skipped > 0 ? (
              <p className="flex items-start gap-2 rounded-xl bg-warn/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-warn">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {skipped} {skipped === 1 ? 'row has' : 'rows have'} no usable date or amount and
                will be left out. Check the column mapping above if that seems wrong.
              </p>
            ) : null}

            {drafts.length > 0 ? (
              <div className="space-y-1.5">
                <span className="block text-[13px] font-medium text-muted">
                  First few, as they will be saved
                </span>
                <div className="divide-y divide-line overflow-hidden rounded-card border border-line">
                  {drafts.slice(0, 5).map((draft, index) => (
                    <div
                      key={`${draft.date}-${index}`}
                      className="flex items-center gap-3 px-3.5 py-2 text-[13px]"
                    >
                      <span className="tnum shrink-0 text-faint">{draft.date}</span>
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {draft.description}
                      </span>
                      <span
                        className={`tnum shrink-0 ${draft.direction === 'in' ? 'text-good' : 'text-muted'}`}
                      >
                        {draft.direction === 'in' ? '+' : '−'}
                        {formatMoney(draft.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */

function guessField(fields: string[], candidates: string[]): string {
  for (const candidate of candidates) {
    const hit = fields.find((field) =>
      field.toLowerCase().replace(/[^a-z]/g, '').includes(candidate),
    );
    if (hit) return hit;
  }
  return NONE;
}

/**
 * Dates the way Indian banks write them, plus ISO.
 *
 * Day-first is assumed for slash and dash formats, because that is what every
 * statement in this country uses. Guessing month-first would silently mangle the
 * first twelve days of every month, which is the worst kind of bug: invisible.
 */
function parseDate(value: string): ISODate | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const head = trimmed.slice(0, 10);
  if (isValidISODate(head)) return head;

  const match = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(trimmed);
  if (!match) return null;

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];

  const iso = `${year}-${month}-${day}`;
  return isValidISODate(iso) ? iso : null;
}

/**
 * Rows become drafts, or they are dropped.
 *
 * Every row gets a stable `externalId` built from what it says, and rows whose
 * key is already in the ledger are skipped. Importing the same statement twice
 * is the single most common way to wreck a set of books, and it is entirely
 * preventable here rather than confusing later.
 */
function buildDrafts(
  rows: Row[],
  map: Mapping,
  accountId: string,
  ledger: Ledger,
): EntryDraft[] {
  const seen = new Set(
    ledger.entries.map((entry) => entry.externalId).filter((key): key is string => Boolean(key)),
  );
  const out: EntryDraft[] = [];

  for (const row of rows) {
    const date = map.date ? parseDate(row[map.date] ?? '') : null;
    if (!date) continue;

    const description = (map.description ? (row[map.description] ?? '') : '').trim();

    // Separate debit and credit columns win, because when a bank supplies both
    // the sign in an "amount" column is often missing entirely.
    const debit = map.debit ? parseAmount(row[map.debit] ?? '') : null;
    const credit = map.credit ? parseAmount(row[map.credit] ?? '') : null;
    const single = map.amount ? parseAmount(row[map.amount] ?? '') : null;

    let amount: number | null = null;
    let direction: Direction = 'out';

    if (debit !== null && debit !== 0) {
      amount = Math.abs(debit);
      direction = 'out';
    } else if (credit !== null && credit !== 0) {
      amount = Math.abs(credit);
      direction = 'in';
    } else if (single !== null && single !== 0) {
      amount = Math.abs(single);
      direction = single < 0 ? 'out' : 'in';
    }

    if (amount === null || amount === 0) continue;

    const label = description || 'Imported entry';
    const externalId = `${accountId}:${date}:${direction}:${amount}:${label.toLowerCase().slice(0, 40)}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const guess = guessCategory(label, amount, direction, ledger);

    out.push({
      amount,
      description: label,
      date,
      direction,
      accountId,
      categoryId: guess.categoryId,
      merchant: guess.merchant,
      tags: guess.tags,
      source: 'import',
      externalId,
    });
  }

  return out;
}
