'use client';

import {
  Banknote,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FileUp,
  Landmark,
  Layers,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import {
  buildStatementDrafts,
  parseStatementFile,
  EMPTY_MAPPING,
  type StatementMapping,
} from '@/domain/statement';
import { formatMoney } from '@/domain/money';
import { Button } from '@/components/ui/button';
import { CustomSelect } from '@/components/ui/custom-select';
import { Field } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { CategoryChip } from '@/components/category/category-icon';
import { useLedger } from '@/lib/store';
import { cn } from '@/lib/utils';

const NONE = '';

export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ledger, addEntries } = useLedger();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'csv' | 'excel' | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<StatementMapping>(EMPTY_MAPPING);
  const [confidence, setConfidence] = useState(0);
  const [accountId, setAccountId] = useState(ledger.accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const accounts = useMemo(
    () => ledger.accounts.filter((a) => !a.archived),
    [ledger.accounts],
  );

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      setFileType(isExcel ? 'excel' : 'csv');

      const parsed = await parseStatementFile(file);
      setFileName(parsed.fileName);
      setFields(parsed.fields);
      setRows(parsed.rows);
      setMap(parsed.detectedMapping);
      setConfidence(parsed.confidence);

      // Try to auto-match account if bank name matches account name
      const lowerName = file.name.toLowerCase();
      const matchedAccount = accounts.find((acc) =>
        lowerName.includes(acc.name.toLowerCase().replace(/[^a-z0-9]/g, '')),
      );
      if (matchedAccount) {
        setAccountId(matchedAccount.id);
      }

      toast(
        `Parsed ${parsed.rows.length} rows with ${parsed.confidence >= 0.7 ? 'high' : 'partial'} auto-detection confidence.`,
        { tone: 'good' },
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not read statement file.', {
        tone: 'bad',
      });
      reset();
    } finally {
      setBusy(false);
    }
  };

  const drafts = useMemo(
    () => (accountId ? buildStatementDrafts(rows, map, accountId, ledger) : []),
    [rows, map, accountId, ledger],
  );

  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const d of drafts) {
      if (d.direction === 'in') totalIn += d.amount;
      else totalOut += d.amount;
    }
    return {
      count: drafts.length,
      skipped: rows.length - drafts.length,
      totalIn,
      totalOut,
    };
  }, [drafts, rows.length]);

  const run = async () => {
    if (drafts.length === 0) return;
    setBusy(true);
    try {
      await addEntries(drafts);
      toast(`${drafts.length} entries successfully imported!`, { tone: 'good' });
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
    setFileType(null);
    setFields([]);
    setRows([]);
    setMap(EMPTY_MAPPING);
    setConfidence(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const column = (label: string, key: keyof StatementMapping, hint?: string) => {
    const options = [
      { value: NONE, label: 'Not in this file / None' },
      ...fields.map((field) => ({ value: field, label: field })),
    ];
    return (
      <Field label={label} hint={hint}>
        <CustomSelect
          value={map[key] || NONE}
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
      title="Import Statement"
      description="Supports Excel (.xlsx, .xls) and CSV exports from all banks and credit cards."
      wide
      footer={
        <Button
          variant="primary"
          onClick={run}
          disabled={busy || drafts.length === 0}
          className="w-full"
        >
          {busy
            ? 'Importing…'
            : drafts.length > 0
            ? `Import ${drafts.length} entries into ${
                accounts.find((a) => a.id === accountId)?.name || 'Account'
              }`
            : 'Select or map columns to import'}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            'group relative flex cursor-pointer items-center gap-3.5 rounded-2xl border-2 border-dashed p-4 transition-all duration-200',
            isDragging
              ? 'border-accent bg-accent/10 shadow-sm'
              : 'border-line/90 bg-surface/70 hover:border-accent/60 hover:bg-raised/50',
          )}
          onClick={() => fileRef.current?.click()}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-raised border border-line/60 text-ink shadow-2xs group-hover:border-accent/40 group-hover:text-accent transition-colors">
            {fileType === 'excel' ? (
              <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
            ) : fileType === 'csv' ? (
              <FileText className="h-6 w-6 text-blue-500" />
            ) : (
              <FileUp className="h-6 w-6 text-faint group-hover:text-accent" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="block truncate text-sm font-semibold text-ink">
                {fileName || 'Drop your Bank Statement or click to browse'}
              </span>
              {fileType && (
                <span className="rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted shrink-0">
                  {fileType === 'excel' ? 'Excel' : 'CSV'}
                </span>
              )}
            </div>
            <span className="block text-[12px] text-faint mt-0.5">
              {rows.length > 0
                ? `${rows.length} rows detected · ${fields.length} columns`
                : 'Supports .xlsx, .xls, .csv files. Metadata headers are skipped automatically.'}
            </span>
          </div>

          {fileName && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="rounded-lg p-1.5 text-faint hover:bg-raised hover:text-ink transition-colors"
              title="Clear file"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>

        {fields.length > 0 ? (
          <>
            {/* Auto-Detection Banner */}
            <div className="flex items-center justify-between rounded-xl border border-line/70 bg-raised/50 px-3.5 py-2.5 text-xs text-muted">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent shrink-0" />
                <span>
                  {confidence >= 0.7
                    ? 'Columns auto-detected from statement header.'
                    : 'Partial match. Verify column mapping below.'}
                </span>
              </div>
              <span className="font-semibold text-ink">
                {stats.count} valid entries found
              </span>
            </div>

            {/* Target Account & Column Mapping Grid */}
            <div className="rounded-2xl border border-line bg-surface/80 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                  Destination & Column Mapping
                </p>
                <span className="text-[11px] text-faint">
                  Adjust if columns differ
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Target Account" hint="Where these transactions belong">
                  <CustomSelect
                    value={accountId}
                    onChange={setAccountId}
                    options={accountOptions}
                    placeholder="Choose an account…"
                  />
                </Field>

                {column('Date Column', 'date', 'DD/MM/YYYY, DD-MMM-YYYY or ISO')}
                {column('Description / Narration', 'description', 'Merchant, particulars or payee')}
                {column('Debit (Withdrawal) Column', 'debit', 'Money out / spent')}
                {column('Credit (Deposit) Column', 'credit', 'Money in / received')}
                {column('Single Amount Column', 'amount', 'If single column with sign or Dr/Cr')}
              </div>
            </div>

            {/* Skipped Notice */}
            {stats.skipped > 0 ? (
              <p className="flex items-start gap-2 rounded-xl bg-warn/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-warn">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {stats.skipped} header/summary rows with no transaction amount were excluded.
                </span>
              </p>
            ) : null}

            {/* Live Preview of Parsed Entries */}
            {drafts.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                    Preview ({drafts.length} entries)
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    {stats.totalOut > 0 && (
                      <span className="text-muted">
                        Out: <span className="font-semibold text-ink">{formatMoney(stats.totalOut)}</span>
                      </span>
                    )}
                    {stats.totalIn > 0 && (
                      <span className="text-good">
                        In: <span className="font-semibold">{formatMoney(stats.totalIn)}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto no-scrollbar divide-y divide-line rounded-2xl border border-line bg-surface/90">
                  {drafts.slice(0, 15).map((draft, index) => {
                    const category = ledger.categories.find((c) => c.id === draft.categoryId);
                    return (
                      <div
                        key={`${draft.date}-${draft.externalId || index}`}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition-colors hover:bg-raised/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {category ? (
                            <CategoryChip
                              name={category.icon}
                              color={category.color}
                              className="h-7 w-7 rounded-lg text-xs shrink-0"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-raised text-faint text-[10px] shrink-0 font-medium">
                              {draft.direction === 'in' ? '+' : '−'}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">
                              {draft.description}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-faint">
                              <span className="tnum">{draft.date}</span>
                              {category && (
                                <span className="truncate">· {category.name}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span
                          className={cn(
                            'tnum shrink-0 font-semibold',
                            draft.direction === 'in' ? 'text-good' : 'text-ink',
                          )}
                        >
                          {draft.direction === 'in' ? '+' : '−'}
                          {formatMoney(draft.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {drafts.length > 15 && (
                  <p className="text-center text-[11px] text-faint">
                    Showing first 15 of {drafts.length} transactions
                  </p>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
