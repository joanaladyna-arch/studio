"use client";

import { Navigation } from "@/components/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Settings, FileText, TrendingUp, BookOpenCheck } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border-4 border-primary/20">
            <AvatarImage src="https://picsum.photos/seed/user/100/100" />
            <AvatarFallback>PL</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-headline">Léa Plume</h1>
            <p className="text-muted-foreground">Lectrice passionnée depuis 2018</p>
          </div>
        </div>
        <Button variant="outline" size="icon"><Settings className="h-5 w-5" /></Button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-secondary/10 border-none shadow-none">
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-secondary" />
            <p className="text-2xl font-bold">142</p>
            <p className="text-xs text-muted-foreground">Livres au total</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-none shadow-none">
          <CardContent className="pt-6 text-center">
            <BookOpenCheck className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">12</p>
            <p className="text-xs text-muted-foreground">Lus ce mois</p>
          </CardContent>
        </Card>
        <Card className="bg-accent/10 border-none hidden md:block shadow-none">
          <CardContent className="pt-6 text-center">
            <Calendar className="h-6 w-6 mx-auto mb-2 text-accent" />
            <p className="text-2xl font-bold">286</p>
            <p className="text-xs text-muted-foreground">Jours consécutifs</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-headline">Ma Progression 2024</h2>
        
        <div className="grid gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Objectif annuel : 24 livres</span>
              <span className="text-muted-foreground">50%</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary w-1/2 rounded-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="border-none bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-bold">Genre favori</p>
                <p className="text-lg font-headline">Roman Historique</p>
              </CardContent>
            </Card>
            <Card className="border-none bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-bold">Format préféré</p>
                <p className="text-lg font-headline">Papier (70%)</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-headline">Rapports d'activité</h2>
        <div className="grid gap-3">
          {["Octobre 2024", "Septembre 2024", "Août 2024"].map((month) => (
            <div key={month} className="flex items-center justify-between p-4 bg-white/50 rounded-xl border group hover:border-primary transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{month}</span>
              </div>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">Consulter</Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
