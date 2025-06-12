"use client";

import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Transaction } from "@/lib/types";

export type SortField = 'date' | 'amount' | 'type';
export type SortOrder = 'asc' | 'desc';

export interface TransactionFilters {
  search: string;
  type: 'all' | 'income' | 'expense';
  category: string;
}

export interface TransactionSort {
  field: SortField;
  order: SortOrder;
}

interface TransactionFiltersProps {
  transactions: Transaction[];
  filters: TransactionFilters;
  sort: TransactionSort;
  onFiltersChange: (filters: TransactionFilters) => void;
  onSortChange: (sort: TransactionSort) => void;
}

export function TransactionFiltersComponent({ 
  transactions, 
  filters, 
  sort, 
  onFiltersChange, 
  onSortChange 
}: TransactionFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get unique categories from transactions
  const availableCategories = useMemo(() => {
    const categories = transactions
      .map(t => t.category)
      .filter((category): category is string => Boolean(category))
      .filter((category, index, arr) => arr.indexOf(category) === index)
      .sort();
    return categories;
  }, [transactions]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search.trim()) count++;
    if (filters.type !== 'all') count++;
    if (filters.category) count++;
    return count;
  }, [filters]);

  const clearAllFilters = () => {
    onFiltersChange({
      search: '',
      type: 'all',
      category: ''
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sort.field !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return sort.order === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-primary" />
      : <ArrowDown className="h-4 w-4 text-primary" />;
  };

  const handleSort = (field: SortField) => {
    if (sort.field === field) {
      // Toggle order if same field
      onSortChange({
        field,
        order: sort.order === 'asc' ? 'desc' : 'asc'
      });
    } else {
      // Set new field with default order
      onSortChange({
        field,
        order: field === 'date' ? 'desc' : 'asc' // Date defaults to newest first
      });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 items-start sm:items-center">
      {/* Quick search */}
      <div className="relative w-full sm:w-auto">
        <Input
          placeholder="Search transactions..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="w-full sm:w-64"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => onFiltersChange({ ...filters, search: '' })}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Advanced filters */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="relative w-full sm:w-auto">
            <Filter className="mr-2 h-4 w-4" />
            Filters & Sort
            {activeFiltersCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 sm:w-80" align="end" side="bottom" sideOffset={5}>
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Filters & Sorting</CardTitle>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs">
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {/* Type Filter */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Transaction Type</Label>
                <Select value={filters.type} onValueChange={(value: any) => onFiltersChange({ ...filters, type: value })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="income">Money In Only</SelectItem>
                    <SelectItem value="expense">Expense Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Category</Label>
                <Select value={filters.category || "all"} onValueChange={(value) => onFiltersChange({ ...filters, category: value === "all" ? "" : value })}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {availableCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Controls */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Sort By</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { field: 'date' as SortField, label: 'Date' },
                    { field: 'amount' as SortField, label: 'Amount' },
                    { field: 'type' as SortField, label: 'Type' },
                  ].map(({ field, label }) => (
                    <Button
                      key={field}
                      variant={sort.field === field ? "default" : "outline"}
                      size="sm"
                      className="justify-between text-xs h-9 w-full"
                      onClick={() => handleSort(field)}
                    >
                      {label}
                      {getSortIcon(field)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Current sort indicator */}
              {sort.field && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  Sorted by <strong>{sort.field}</strong> ({sort.order === 'asc' ? 'ascending' : 'descending'})
                </div>
              )}
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
} 