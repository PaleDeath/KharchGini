import { Metadata } from 'next';
import { CSVImporter } from '@/components/CSVImporter';

export const metadata: Metadata = {
  title: 'Import Transactions - KharchGini',
  description: 'Import your bank statements via CSV.',
};

export default function ImportTransactionsPage() {
  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Import Transactions</h1>
        <p className="text-muted-foreground">
          Upload your bank statement (CSV) to bulk import transactions.
        </p>
      </div>

      <CSVImporter />
    </div>
  );
}
