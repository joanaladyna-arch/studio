"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Star, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Gratuit",
    price: "0€",
    icon: Sparkles,
    color: "text-slate-400",
    features: [
      "Bibliothèque illimitée", 
      "Gestion PAL & DNF", 
      "Journal de lecture complet", 
      "Journal d'écoute audio", 
      "Classement Plume authentique",
      "Statistiques de base"
    ],
    button: "Actuel"
  },
  {
    name: "Plume Plus",
    price: "4.99€/mois",
    icon: Star,
    color: "text-primary",
    features: [
      "Thèmes Premium exclusifs", 
      "Icônes d'application premium", 
      "Export PDF de ton journal", 
      "Badges émotionnels avancés", 
      "Statistiques détaillées", 
      "Passeport de Lectrice complet"
    ],
    button: "Choisir Plus",
    popular: true
  },
  {
    name: "Plume Royale",
    price: "9.99€/mois",
    icon: Crown,
    color: "text-amber-500",
    features: [
      "Tout Plume Plus", 
      "Templates BookTok/Insta premium", 
      "Collections privées illimitées", 
      "Sauvegarde sécurisée", 
      "Personnalisation avancée", 
      "Archives annuelles de lecture"
    ],
    button: "Devenir Royale"
  }
];

export default function SubscriptionPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header className="text-center space-y-2 py-8">
        <h1 className="text-4xl font-headline">Sublime ton expérience Plume</h1>
        <p className="text-muted-foreground max-w-lg mx-auto italic">“Garde une trace précieuse de ton voyage littéraire avec nos outils premium.”</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.name} className={cn(
            "relative glass-card border-2 flex flex-col transition-all duration-300",
            plan.popular ? "border-primary shadow-xl scale-105 z-10" : "border-transparent"
          )}>
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white px-4">Le plus aimé</Badge>
            )}
            <CardHeader className="text-center">
              <plan.icon className={cn("h-10 w-10 mx-auto mb-4", plan.color)} />
              <CardTitle className="text-2xl font-headline">{plan.name}</CardTitle>
              <div className="text-3xl font-bold mt-2">{plan.price}</div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <ul className="space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className={cn(
                "w-full rounded-xl py-6 font-bold", 
                plan.popular ? "bg-primary hover:bg-primary/90 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}>
                {plan.button}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
