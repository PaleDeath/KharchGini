'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ParsedRow } from '@/lib/csvParser';
import { DuplicateResult } from '@/lib/duplicateCheck';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PreviewRow extends ParsedRow {
  id: string; // Temporary ID for UI
  selected: boolean;
  category: string;
  status: 'new' | 'duplicate';
  isDuplicate: boolean;
  duplicateMatchId?: string;
}

interface ImportPreviewProps {
  data: DuplicateResult[];
  onImport: (selectedRows: PreviewRow[]) => Promise<void>;
  onCancel: () => void;
  isImporting: boolean;
}

const CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Fuel",
  "Cash Withdrawal",
  "Transfer",
  "Income",
  "Transportation",
  "Bills & Utilities",
  "Healthcare",
  "Entertainment",
  "Uncategorized"
];

export function ImportPreview({ data, onImport, onCancel, isImporting }: ImportPreviewProps) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'new' | 'duplicate'>('all');

  useEffect(() => {
    // Initialize rows with selection logic: New -> selected, Duplicate -> unselected
    const initializedRows = data.map((item, index) => ({
      ...item.row,
      id: `row-${index}`,
      selected: !item.isDuplicate, // Default select new ones
      category: (item.row as any).category || 'Uncategorized', // Assuming autoCategorize added category to ParsedRow?
      status: item.isDuplicate ? 'duplicate' : 'new',
      isDuplicate: item.isDuplicate,
      duplicateMatchId: item.match?.id
    } as PreviewRow));
    setRows(initializedRows);
  }, [data]);

  const handleSelectAll = (checked: boolean) => {
    setRows(prev => prev.map(r => {
      // If filtering, only select visible? Or all? Usually visible.
      // But for simplicity, select all matching filter or all if no filter.
      if (filter === 'all' || r.status === filter) {
        return { ...r, selected: checked };
      }
      return r;
    }));
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, selected: checked } : r));
  };

  const handleCategoryChange = (id: string, category: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, category } : r));
  };

  const handleDescriptionChange = (id: string, description: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, description } : r));
  };

  const filteredRows = rows.filter(r => filter === 'all' || r.status === filter);
  const selectedCount = rows.filter(r => r.selected).length;
  const duplicateCount = rows.filter(r => r.isDuplicate).length;
  const newCount = rows.length - duplicateCount;

  const handleImportClick = () => {
    const selected = rows.filter(r => r.selected);
    onImport(selected);
  };

  if (rows.length === 0) {
    return <div className="text-center p-8 text-muted-foreground">No transactions to preview.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold">Preview Transactions</h2>
          <p className="text-sm text-muted-foreground">
            {rows.length} found • {newCount} new • <span className="text-amber-600 font-medium">{duplicateCount} duplicates</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: !r.isDuplicate })))}>
             Reset Selection
           </Button>
           <div className="flex items-center border rounded-md overflow-hidden">
             <Button
               variant={filter === 'all' ? 'secondary' : 'ghost'}
               size="sm"
               className="rounded-none px-3"
               onClick={() => setFilter('all')}
             >
               All
             </Button>
             <Button
               variant={filter === 'new' ? 'secondary' : 'ghost'}
               size="sm"
               className="rounded-none px-3"
               onClick={() => setFilter('new')}
             >
               New
             </Button>
             <Button
               variant={filter === 'duplicate' ? 'secondary' : 'ghost'}
               size="sm"
               className="rounded-none px-3"
               onClick={() => setFilter('duplicate')}
             >
               Duplicates
             </Button>
           </div>
        </div>
      </div>

      <div className="border rounded-md max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={filteredRows.length > 0 && filteredRows.every(r => r.selected)}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.id} className={cn(row.isDuplicate && "bg-muted/30")}>
                <TableCell>
                  <Checkbox
                    checked={row.selected}
                    onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(row.date), 'dd MMM yyyy')}
                </TableCell>
                <TableCell className="min-w-[200px]">
                  <Input
                    value={row.description}
                    onChange={(e) => handleDescriptionChange(row.id, e.target.value)}
                    className="h-8 text-sm"
                  />
                  {row.originalDescription !== row.description && (
                    <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]" title={row.originalDescription}>
                      Orig: {row.originalDescription}
                    </div>
                  )}
                </TableCell>
                <TableCell className={cn(
                  "font-medium tabular-nums",
                  row.type === 'income' ? "text-green-600" : "text-red-600"
                )}>
                  {row.type === 'income' ? '+' : '-'}{row.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                </TableCell>
                <TableCell className="w-[180px]">
                  <Select value={row.category} onValueChange={(val) => handleCategoryChange(row.id, val)}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {row.isDuplicate ? (
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                      Duplicate
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      New
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isImporting}>
          Cancel
        </Button>
        <Button onClick={handleImportClick} disabled={selectedCount === 0 || isImporting}>
          {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Import {selectedCount} Transactions
        </Button>
      </div>
    </div>
  );
}
