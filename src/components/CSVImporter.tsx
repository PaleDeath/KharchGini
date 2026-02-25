'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/contexts/auth-context';
import { parseCSV, BankFormat, ParsedRow } from '@/lib/csvParser';
import { categorizeTransaction } from '@/lib/autoCategorize';
import { checkForDuplicates, DuplicateResult } from '@/lib/duplicateCheck';
import { importTransactions } from '@/actions/importTransactions';
import { ImportPreview, PreviewRow } from './ImportPreview';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const BANKS: BankFormat[] = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'Union', 'Other'];

export function CSVImporter() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload');
  const [bank, setBank] = useState<BankFormat>('HDFC');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<DuplicateResult[]>([]);
  const [importStats, setImportStats] = useState<{ success: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1,
    maxSize: 2 * 1024 * 1024 // 2MB
  });

  const handleProcessFile = async () => {
    if (!file || !user) return;

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Parse CSV
      const parsedRows = await parseCSV(file, bank);

      if (parsedRows.length === 0) {
        throw new Error("No valid transactions found in file. Please check the format.");
      }

      // 2. Auto Categorize
      const categorizedRows = parsedRows.map(row => {
        const catResult = categorizeTransaction(row.description, row.amount, row.type);
        return {
          ...row,
          category: catResult.category,
          merchant: catResult.merchant
        };
      });

      // 3. Duplicate Check
      // We pass the rows to duplicate check.
      // Note: checkForDuplicates expects ParsedRow[], and categorizedRows extends ParsedRow.
      const { all } = await checkForDuplicates(user.uid, categorizedRows);

      setPreviewData(all);
      setStep('preview');
    } catch (err) {
      console.error("Processing error:", err);
      setError(err instanceof Error ? err.message : "Failed to process file");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async (selectedRows: PreviewRow[]) => {
    if (!user) return;

    setIsProcessing(true);
    try {
      const result = await importTransactions(user.uid, selectedRows);

      if (result.errors.length > 0) {
        console.warn("Import warnings:", result.errors);
      }

      setImportStats({ success: result.success, failed: result.failed });
      setStep('success');
      toast({
        title: "Import Complete",
        description: `Successfully imported ${result.success} transactions.`
      });
    } catch (err) {
      console.error("Import execution error:", err);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: "An error occurred while saving transactions."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setPreviewData([]);
    setImportStats(null);
    setError(null);
  };

  if (step === 'success' && importStats) {
    return (
      <Card className="max-w-md mx-auto mt-8 text-center">
        <CardHeader>
          <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle>Import Successful</CardTitle>
          <CardDescription>
            Your transactions have been added to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-2xl font-bold">{importStats.success}</div>
              <div className="text-sm text-muted-foreground">Imported</div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{importStats.failed}</div>
              <div className="text-sm text-muted-foreground">Skipped/Failed</div>
            </div>
          </div>
          <Button onClick={handleReset} className="w-full">
            Import Another Statement
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'preview') {
    return (
      <Card className="w-full max-w-5xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Review & Import</CardTitle>
          <CardDescription>
            Review the extracted transactions, edit categories if needed, and select which ones to import.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportPreview
            data={previewData}
            onImport={handleImport}
            onCancel={handleReset}
            isImporting={isProcessing}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Import Bank Statement</CardTitle>
        <CardDescription>
          Upload your bank statement CSV to automatically import transactions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Bank Format</label>
          <Select value={bank} onValueChange={(val) => setBank(val as BankFormat)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Bank" />
            </SelectTrigger>
            <SelectContent>
              {BANKS.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            ${file ? 'bg-muted/30' : ''}
          `}
        >
          <input {...getInputProps()} />

          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-10 w-10 text-primary" />
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="mt-2 text-red-500 hover:text-red-600 hover:bg-red-50">
                Remove File
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="h-10 w-10 mb-2" />
              <p>Drag & drop your CSV file here, or click to select</p>
              <p className="text-xs">Supports HDFC, ICICI, SBI, and more (Max 2MB)</p>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={handleProcessFile} disabled={!file || isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : "Review Transactions"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
