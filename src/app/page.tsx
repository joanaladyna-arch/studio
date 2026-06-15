"use client";

import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BookOpen, Star, Clock, Trophy, PenTool, Sparkles } from "lucide-react";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function Home() {
  const currentRead = {
    title: "L'élégance du hérisson",
    author: "Muriel Barbery",
    progress: 65,
    pagesRead: 210,
    totalPages: 320,
    cover: "https://picsum.photos/seed/book1/200/300"
  };

  const stats = [
    { label: "Livres Lus", value: 12, icon: BookOpen, color: "text-primary" },
    { label: "En cours", value: 2, icon: Clock, color: "text-chart-3" },
    { label: "Objectif 2024", value: "12/24", icon: Trophy, color: "text-chart-2" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <Navigation />
      
      <header className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-headline text-foreground">Bonjour, Léa</h1>
            <p className="text-muted-foreground italic mt-1">“Tes lectures, tes mots, tes émotions.”</p>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
          <p className="text-sm text-primary-foreground/80 font-medium">
            Plume est un journal de lecture authentique, sans IA obligatoire, pensé pour garder une trace sincère de tes lectures.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="glass-card hover:shadow-md transition-shadow">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className={cn("p-2 rounded-lg bg-background", stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-headline">Ma lecture du moment</h2>
        <Card className="overflow-hidden border-none shadow-lg">
          <div className="grid md:grid-cols-[150px_1fr] gap-6">
            <div className="relative aspect-[2/3] md:h-full">
              <Image 
                src={currentRead.cover} 
                alt={currentRead.title}
                fill
                className="object-cover"
                data-ai-hint="book cover"
              />
            </div>
            <CardContent className="p-6 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-headline">{currentRead.title}</h3>
                    <p className="text-muted-foreground italic">{currentRead.author}</p>
                  </div>
                  <Badge variant="secondary" className="bg-secondary/20 text-secondary-foreground">
                    En cours
                  </Badge>
                </div>
                <div className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progression</span>
                    <span className="font-medium">{currentRead.progress}%</span>
                  </div>
                  <Progress value={currentRead.progress} className="h-2 bg-muted" />
                  <p className="text-xs text-muted-foreground">{currentRead.pagesRead} sur {currentRead.totalPages} pages</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button asChild variant="default" className="flex-1 bg-accent hover:bg-accent/90">
                  <Link href="/journal">
                    <PenTool className="mr-2 h-4 w-4" />
                    Écrire une réflexion
                  </Link>
                </Button>
                <Button variant="outline" size="icon">
                  <Star className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-headline text-primary">Dernières pépites</h2>
          <Button variant="link" asChild className="text-primary p-0">
            <Link href="/library">Voir ma bibliothèque</Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="group cursor-pointer">
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-300">
                <Image 
                  src={`https://picsum.photos/seed/recent${i}/200/300`} 
                  alt="Recent book"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <p className="mt-2 text-sm font-medium line-clamp-1 italic">Titre du livre {i}</p>
              <p className="text-xs text-muted-foreground">Auteur {i}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}