
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HeartPulse } from "lucide-react";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis, Tooltip } from 'recharts';

interface FinancialHealthWidgetProps {
  score: number; // Score from 0 to 100
}

export function FinancialHealthWidget({ score }: FinancialHealthWidgetProps) {
  const data = [{ name: 'Health Score', value: score, fill: 'hsl(var(--primary))' }];

  let descriptionText = "Keep up the great work!";
  if (score < 40) {
    descriptionText = "Needs significant improvement. Let's work on it!";
  } else if (score < 70) {
    descriptionText = "Good start, but there's room to grow.";
  }

  return (
    <Card className="shadow-md lg:col-span-1">
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
                <HeartPulse className="mr-2 h-5 w-5 text-primary" />
                Financial Health Score
            </CardTitle>
        </div>
        <CardDescription>{descriptionText}</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] flex flex-col items-center justify-center">
        <ResponsiveContainer width="100%" height="80%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            barSize={20}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background
              dataKey="value"
              angleAxisId={0}
              // fill="hsl(var(--primary))" // Fill is set in data object
              cornerRadius={10}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
              }}
              formatter={(value: number) => [`${value}/100`, "Score"]}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <p className="text-3xl font-bold text-foreground -mt-8">{score}<span className="text-sm text-muted-foreground">/100</span></p>
      </CardContent>
    </Card>
  );
}

    