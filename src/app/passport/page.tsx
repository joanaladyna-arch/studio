
"use client";

import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Book, Flame, Map, Search, Crown, Heart } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useUser } from "@/firebase";

const TITLES = [
  { name: "Exploratrice Littéraire", icon: Search, color: "bg-blue-100 text-blue-600", desc: "Avoir cherché 50 livres" },
  { name: "Reine de la Romance", icon: Heart, color: "bg-rose-100 text-rose-600", desc: "10 romances classées Diamant" },
  { name: "Maîtresse des Dragons", icon: Flame, color: "bg-orange-100 text-orange-600", desc: "5 sagas fantasy complétées" },
  { name: "Lectrice Royale", icon: Crown, color: "bg-amber-100 text-amber-600", desc: "Abonnement Plume Royale" },
  { name: "BookTok Addict", icon: Trophy, color: "bg-purple-100 text-purple-600", desc: "5 fiches partagées" },
  { name: "Voyageuse des Mondes", icon: Map, color: "bg-emerald-100 text-emerald-600", desc: "Livres de 5 continents différents" },
  { name: "Chasseuse de Pépites", icon: Star, color: "bg-yellow-100 text-yellow-600", desc: "Avoir déterré un livre oublié" },
];

export default function PassportPage() {
  const { user } = useUser();
  const userName = user?.displayName || user?.email?.split('@')[0] || "Lectrice Plume";
  const userPhoto = user?.photoURL || `https://picsum.photos/seed/${user?.uid}/200/200`;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <Navigation />

      <header className="flex items-center justify-between pt-8">
        <div>
          <h1 className="text-4xl font-headline italic">Passeport de Lectrice</h1>
          <p className="text-muted-foreground italic">Votre identité et vos exploits littéraires.</p>
        </div>
        <div className="h-16 w-16 bg-primary/20 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
           <Trophy className="h-8 w-8 text-primary" />
        </div>
      </header>

      <section className="grid gap-6">
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-none shadow-none rounded-[3rem]">
          <CardContent className="p-8 flex flex-col md:flex-row gap-8 items-center text-center md:text-left">
            <div className="h-32 w-32 relative rounded-2xl overflow-hidden border-4 border-white shadow-xl rotate-3">
              <Image src={userPhoto} alt="Avatar" fill className="object-cover" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-headline italic">{userName}</h2>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <Badge className="bg-primary/20 text-primary border-none">Exploratrice Plume</Badge>
                <Badge variant="outline" className="border-primary/20 text-primary/60 italic">Membre depuis peu</Badge>
              </div>
              <p className="text-sm text-muted-foreground italic">"Chaque livre est une nouvelle vie."</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="text-2xl font-headline italic">Mes Titres & Badges</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {TITLES.map((t) => (
              <Card key={t.name} className="glass-card flex items-center p-4 gap-4 opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-help border-none">
                <div className={cn("p-3 rounded-full", t.color)}>
                  <t.icon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm italic">{t.name}</h4>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">{t.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
