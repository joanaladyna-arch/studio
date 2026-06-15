
"use client";

import { useMemo } from "react";
import { Navigation } from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useUser, useFirestore, useCollection } from "@/firebase";
import { collection } from "firebase/firestore";

export default function StatsPage() {
  const { user } = useUser();
  const db = useFirestore();

  const booksQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "books");
  }, [db, user]);

  const { data: books = [] } = useCollection(booksQuery);

  const stats = useMemo(() => {
    const read = books.filter(b => b.status === 'read').length;
    const progress = books.filter(b => b.status === 'progress').length;
    const totalPages = books.reduce((acc, b) => acc + (b.pagesRead || 0), 0);
    
    return {
      read,
      progress,
      totalPages
    };
  }, [books]);

  const goals = [
    { label: "Objectif Annuel", current: stats.read, total: 24, icon: Target, color: "bg-primary" },
    { label: "Objectif Mensuel", current: stats.read > 0 ? 1 : 0, total: 3, icon: Target, color: "bg-chart-2" },
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
              <p className="text-2xl font-bold">{stats.read}</p>
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
              <p className="text-2xl font-bold">{stats.totalPages.toLocaleString()}</p>
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
              <p className="text-2xl font-bold">0h 0m</p>
            </div>
          </CardContent>
        </Card>
      </section>

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
