"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, RefreshCw, Check, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/categories";

export interface ExtractedData {
  amount?: { value: number; confidence: number };
  date?: { value: Date; confidence: number };
  merchant?: { value: string; confidence: number };
  category?: { value: string; confidence: number };
}

interface ReceiptDataEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ExtractedData;
  onConfirm: (data: {
    description: string;
    amount: number;
    date: Date;
    category: string;
  }) => void;
  onRetry: () => void;
}

// Simple mapping for merchant to category suggestion
const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  'zomato': 'Food & Dining',
  'swiggy': 'Food & Dining',
  'uber': 'Transportation',
  'ola': 'Transportation',
  'amazon': 'Shopping',
  'flipkart': 'Shopping',
  'myntra': 'Shopping',
  'starbucks': 'Food & Dining',
  'mcdonalds': 'Food & Dining',
  'kfc': 'Food & Dining',
  'shell': 'Transportation',
  'bp': 'Transportation',
  'netflix': 'Entertainment',
  'spotify': 'Entertainment',
};

export function ReceiptDataEditor({
  open,
  onOpenChange,
  data,
  onConfirm,
  onRetry,
}: ReceiptDataEditorProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [category, setCategory] = useState<string>("");

  // Initialize state from props
  useEffect(() => {
    if (open) {
      setDescription(data.merchant?.value || "");
      setAmount(data.amount?.value?.toString() || "");
      setDate(data.date?.value || new Date());
      setCategory(data.category?.value || "");
    }
  }, [open, data]);

  // Auto-suggest category based on merchant name
  useEffect(() => {
    if (description && !category) {
      const lowerDesc = description.toLowerCase();
      // Check direct mapping or includes
      for (const [key, value] of Object.entries(MERCHANT_CATEGORY_MAP)) {
        if (lowerDesc.includes(key)) {
          setCategory(value);
          break;
        }
      }
    }
  }, [description, category]);

  const handleConfirm = () => {
    if (!description || !amount || !date || !category) {
      // Basic validation - could be improved
      return;
    }

    onConfirm({
      description,
      amount: parseFloat(amount),
      date,
      category,
    });
  };

  const getConfidenceIcon = (confidence?: number) => {
    if (confidence === undefined) return null;
    if (confidence > 0.8) return <Check className="h-4 w-4 text-green-600" />;
    if (confidence > 0.5) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <AlertCircle className="h-4 w-4 text-red-600" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Review Receipt Data</DialogTitle>
          <DialogDescription>
            Verify the extracted information below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Merchant / Description */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="merchant">Merchant</Label>
              <div className="flex items-center gap-1 text-xs">
                {getConfidenceIcon(data.merchant?.confidence)}
                <span className={cn(
                  data.merchant?.confidence && data.merchant.confidence > 0.8 ? "text-green-600" :
                  data.merchant?.confidence && data.merchant.confidence > 0.5 ? "text-yellow-600" : "text-red-600"
                )}>
                  {data.merchant?.confidence ? `${Math.round(data.merchant.confidence * 100)}%` : 'N/A'}
                </span>
              </div>
            </div>
            <Input
              id="merchant"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(
                "transition-colors",
                data.merchant?.confidence && data.merchant.confidence <= 0.5 && "border-red-300 bg-red-50"
              )}
            />
          </div>

          {/* Amount */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount</Label>
              <div className="flex items-center gap-1 text-xs">
                {getConfidenceIcon(data.amount?.confidence)}
                <span className={cn(
                  data.amount?.confidence && data.amount.confidence > 0.8 ? "text-green-600" :
                  data.amount?.confidence && data.amount.confidence > 0.5 ? "text-yellow-600" : "text-red-600"
                )}>
                  {data.amount?.confidence ? `${Math.round(data.amount.confidence * 100)}%` : 'N/A'}
                </span>
              </div>
            </div>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={cn(
                "transition-colors",
                data.amount?.confidence && data.amount.confidence <= 0.5 && "border-red-300 bg-red-50"
              )}
            />
          </div>

          {/* Date */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Date</Label>
              <div className="flex items-center gap-1 text-xs">
                {getConfidenceIcon(data.date?.confidence)}
                <span className={cn(
                  data.date?.confidence && data.date.confidence > 0.8 ? "text-green-600" :
                  data.date?.confidence && data.date.confidence > 0.5 ? "text-yellow-600" : "text-red-600"
                )}>
                  {data.date?.confidence ? `${Math.round(data.date.confidence * 100)}%` : 'N/A'}
                </span>
              </div>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                    data.date?.confidence && data.date.confidence <= 0.5 && "border-red-300 bg-red-50"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Category */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="category">Category</Label>
              <div className="flex items-center gap-1 text-xs">
                {getConfidenceIcon(data.category?.confidence)}
                <span className={cn(
                  data.category?.confidence && data.category.confidence > 0.8 ? "text-green-600" :
                  data.category?.confidence && data.category.confidence > 0.5 ? "text-yellow-600" : "text-red-600"
                )}>
                  {data.category?.confidence ? `${Math.round(data.category.confidence * 100)}%` : 'Auto'}
                </span>
              </div>
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className={cn(
                !category && "text-muted-foreground",
                data.category?.confidence && data.category.confidence <= 0.5 && "border-red-300 bg-red-50"
              )}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
          <Button onClick={handleConfirm} disabled={!description || !amount || !date || !category} className="gap-2">
            <Check className="h-4 w-4" />
            Looks Good
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
