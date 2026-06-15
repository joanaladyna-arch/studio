"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Check, Crown, Star, Sparkles } from "lucide-react";

const PLANS = [
  {
    name: "Gratuit",
    price: "0€",
    icon: Sparkles,
    color: "text-slate-400",
    features: ["Bibliothèque illimitée", "PAL & DNF", "Journal de lecture", "Statistiques simples", "Navigation basique"],
    button: "Actuel"
  },
  {
    name: "Plume Plus",
    price: "4.99€/mois",
    icon: Star,
    color: "text-primary",
    features: ["IA de recommandations", "Bilan mensuel narratif", "Thèmes Premium", "Icônes exclusives", "Export PDF du journal", "Badges avancés"],
    button: "Choisir Plus",
    popular: true
  },
  {
    name: "Plume Royale",
    price: "9.99€/mois",
    icon: Crown,
    color: "text-amber-500",
    features: ["Tout Plume Plus", "Générateur BookTok/Insta", "Statistiques avancées", "Passeport de Lectrice", "Sauvegarde Cloud", "IA Prioritaire"],
    button: "Devenir Royale"
  }
];

export default function SubscriptionPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header className="text-center space-y-2">
        <h1 className="text-4xl font-headline">Sublimez votre lecture</h1>
        <p className="text-muted-foreground">Choisissez la formule qui correspond à votre passion.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.name} className={cn(
            "relative glass-card border-2 flex flex-col",
            plan.popular ? "border-primary shadow-xl scale-105" : "border-transparent"
          )}>
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white">Le plus aimé</Badge>
            )}
            <CardHeader className="text-center">
              <plan.icon className={cn("h-10 w-10 mx-auto mb-4", plan.color)} />
              <CardTitle className="text-2xl font-headline">{plan.name}</CardTitle>
              <div className="text-3xl font-bold mt-2">{plan.price}</div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <ul className="space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className={cn("w-full", plan.popular ? "bg-primary" : "bg-muted text-muted-foreground")}>
                {plan.button}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}