"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, TrendingUp, TrendingDown } from "lucide-react";

const expenseCategories = [
  "Food & Dining",
  "Transportation", 
  "Shopping",
  "Bills & Utilities",
  "Healthcare",
  "Entertainment",
  "Education",
  "Travel & Vacation",
  "Insurance",
  "Investments",
  "Personal Care",
  "Home & Garden",
  "Gifts & Donations",
  "Professional Services",
  "Miscellaneous"
];

const incomeCategories = [
  "Salary",
  "Business Income",
  "Investment Returns",
  "Rental Income",
  "Other Income"
];

export function CategoryReference() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HelpCircle className="mr-2 h-4 w-4" />
          Category Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Transaction Categories Reference</DialogTitle>
          <DialogDescription>
            AI automatically categorizes your transactions into these categories. You can also manually assign them.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {/* Expense Categories */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <h3 className="text-lg font-semibold text-foreground">Expense Categories</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {expenseCategories.map((category) => (
                  <Badge key={category} variant="outline" className="justify-start text-left py-2 h-auto">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Income Categories */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-foreground">Income Categories</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {incomeCategories.map((category) => (
                  <Badge key={category} variant="outline" className="justify-start text-left py-2 h-auto bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Tips */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 text-foreground">💡 AI Categorization Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Include brand names (Zomato, Uber, Amazon) for better accuracy</li>
                <li>• Be specific in descriptions (e.g., "Uber ride to office" vs "travel")</li>
                <li>• The AI recognizes Indian brands and payment methods</li>
                <li>• You can manually edit categories anytime</li>
                <li>• Confidence scores help you understand AI certainty</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 