"use client";

import { Navigation } from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Headphones, FileText, Target, BarChart3, PieChart } from "lucide-react";
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip,
  Cell,
  Pie,
  PieChart as RechartsPieChart
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const monthlyData = [
  { month: "Jan", books: 2 },
  { month: "Fév", books: 1 },
  { month: "Mar", books: 3 },
  { month: "Avr", books: 2 },
  { month: "Mai", books: 4 },
  { month: "Juin", books: 2 },
  { month: "Juil", books: 0 },
  { month: "Août", books: 1 },
  { month: "Sep", books: 3 },
  { month: "Oct", books: 2 },
  { month: "Nov", books: 0 },
  { month: "Déc", books: 0 },
];

const genreData = [
  { name: "Roman", value: 45, color: "hsl(var(--primary))" },
  { name: "Essai", value: 25, color: "hsl(var(--chart-2))" },
  { name: "BD/Manga", value: 20, color: "hsl(var(--chart-3))" },
  { name: "Poésie", value: 10, color: "hsl(var(--accent))" },
];

export default function StatsPage() {
  const goals = [
    { label: "Objectif Annuel", current: 12, total: 24, icon: Target, color: "bg-primary" },
    { label: "Objectif Mensuel", current: 2, total: 3, icon: Target, color: "bg-chart-2" },
    { label: "Objectif Hebdo", current: 0, total: 1, icon: Target, color: "bg-accent" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24">
      <Navigation />

      <header>
        <h1 className="text-4xl font-headline">Mes statistiques</h1>
        <p className="text-muted-foreground">Analyse de vos habitudes de lecture et d'écoute.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Livres lus</p>
              <p className="text-2xl font-bold">12</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-chart-3/10 text-chart-3">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pages lues</p>
              <p className="text-2xl font-bold">3 450</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Temps d'écoute</p>
              <p className="text-2xl font-bold">42h 15m</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h2 className="text-2xl font-headline flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Progression mensuelle
          </h2>
          <Card className="p-4 glass-card h-[300px]">
            <ChartContainer config={{
              books: { label: "Livres", color: "hsl(var(--primary))" }
            }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="books" fill="var(--color-books)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-headline flex items-center gap-2">
            <PieChart className="h-6 w-6 text-accent" /> Répartition par genre
          </h2>
          <Card className="p-4 glass-card h-[300px] flex items-center justify-center">
             <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={genreData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {genreData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
             </ResponsiveContainer>
             <div className="space-y-2 ml-4">
                {genreData.map((g) => (
                  <div key={g.name} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                    <span className="font-medium">{g.name}</span>
                    <span className="text-muted-foreground">{g.value}%</span>
                  </div>
                ))}
             </div>
          </Card>
        </section>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-headline flex items-center gap-2">
          <Target className="h-6 w-6 text-chart-2" /> Mes Objectifs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {goals.map((goal, i) => (
            <Card key={i} className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{goal.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-end">
                  <p className="text-2xl font-bold">{goal.current} / {goal.total}</p>
                  <p className="text-xs text-muted-foreground font-bold">
                    {Math.round((goal.current / goal.total) * 100)}%
                  </p>
                </div>
                <Progress value={(goal.current / goal.total) * 100} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
