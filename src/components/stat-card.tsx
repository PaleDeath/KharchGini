import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description?: string;
  trend?: string; // e.g., "+5.2% from last month"
  trendColor?: 'text-emerald-500' | 'text-red-500'; // Simplified trend colors
}

export function StatCard({ title, value, icon: Icon, description, trend, trendColor }: StatCardProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
        {trend && <p className={`text-xs ${trendColor || 'text-muted-foreground'} pt-1`}>{trend}</p>}
      </CardContent>
    </Card>
  );
}
