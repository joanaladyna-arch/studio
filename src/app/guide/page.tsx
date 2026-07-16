"use client";

import Link from "next/link";
import { ArrowLeft, HelpCircle, Library, Plus, User, Heart, Newspaper, BookOpen, BarChart3, Users, Share2, Feather, Sparkles } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { cn } from "@/lib/utils";

/**
 * "Comment utiliser Lectoria" — guide simple des fonctionnalités,
 * accessible depuis Profil. Maintenu à la main à chaque évolution
 * importante de l'app (aucune mise à jour "automatique" possible :
 * l'app ne peut pas deviner seule ce qui a changé et l'expliquer
 * clairement — c'est une tenue à jour humaine, comme les récaps PDF).
 */
const SECTIONS = [
  {
    icon: Library,
    title: "Bibliothèque",
    items: [
      "Tous tes livres sont rangés par blocs : En cours, PAL (à lire), Lu, Wishlist et DNF (abandonnés) — tous visibles en même temps, l'un en dessous de l'autre.",
      "Le bouton \"Sélectionner\" permet de cocher plusieurs livres à la fois, par exemple pour les retirer de tes objectifs de lecture.",
      "\"Surprends-moi\" (le petit dé) tire un livre au hasard dans ta PAL quand tu ne sais pas quoi lire ensuite.",
      "Le bouton avec l'appareil photo scanne le code-barres d'un livre physique pour l'ajouter instantanément.",
    ],
  },
  {
    icon: Plus,
    title: "Ajouter un livre",
    items: [
      "Cherche par titre, auteur ou éditeur — les résultats viennent de Google Books et Apple Books.",
      "\"Ma précédente recherche\" relance en un clic ta dernière recherche.",
      "Une fois le livre choisi, indique son statut (En cours, PAL, Lu...) et son format (papier, ebook, audio...).",
    ],
  },
  {
    icon: BookOpen,
    title: "La fiche d'un livre",
    items: [
      "\"Ma Note\" : ta note personnelle sur 5 étoiles, demi-étoiles possibles (3,5 / 4,5).",
      "\"Mon Rang\" (la Palme) : réservé à tes tout meilleurs souvenirs de lecture — plus rare et plus précieux qu'une simple bonne note. Le petit (i) à côté de chacun explique la différence.",
      "Renseigne les pages lues (ou la durée d'écoute pour l'audio) : ça alimente ton Bilan de lecture.",
      "\"Service de presse\" : coche cette case pour un livre reçu en service de presse — un petit ruban \"SP\" apparaît alors sur sa couverture.",
      "\"Pépite Incontournable\" : coche cette case pour recommander ce livre à la communauté — il apparaîtra sur ton profil (et sur ton profil public, si activé).",
      "Le bouton \"Suivre\" à côté de la Maison d'édition permet d'être alertée des nouveautés de cet éditeur.",
    ],
  },
  {
    icon: Heart,
    title: "Coups de Cœur",
    items: [
      "Regroupe tous les livres auxquels tu as attribué une Palme (\"Mon Rang\" sur la fiche du livre), classés par niveau.",
      "\"Relecture d'été\" : une sélection à part pour tes envies de relecture.",
    ],
  },
  {
    icon: Feather,
    title: "Journal",
    items: [
      "\"Notes au fil de l'eau\" : notes rapides liées à un livre en cours ou dans ta PAL — le livre disparaît automatiquement de la liste dès qu'il est marqué comme lu.",
      "\"Carnet de Citations\" : les passages que tu choisis de garder, livre par livre.",
      "Tes avis complets, écrits depuis la fiche de chaque livre, sont aussi rassemblés ici.",
    ],
  },
  {
    icon: BarChart3,
    title: "Bilan de lecture",
    items: [
      "Ton nombre de livres lus, ton rythme, ton genre dominant, ta maison d'édition la plus lue...",
      "L'Objectif Annuel ne compte que les livres lus depuis le 1er janvier de l'année en cours.",
      "Exportable en PDF depuis le bouton en haut de la page.",
    ],
  },
  {
    icon: Newspaper,
    title: "Actualités",
    items: [
      "Les nouveautés des auteurs et éditeurs que tu suis, détectées automatiquement puis validées avant publication.",
      "\"Sorties de la semaine\" met en avant les parutions les plus récentes tout en haut de la page.",
    ],
  },
  {
    icon: Users,
    title: "Communauté",
    items: [
      "Suis d'autres lectrices et retrouve les avis qu'elles ont choisi de partager.",
      "Rien n'est visible par défaut : active \"Visible dans la communauté\" dans ton profil pour apparaître dans l'annuaire.",
    ],
  },
  {
    icon: Share2,
    title: "Partage & Réseaux sociaux",
    items: [
      "Génère une carte élégante pour un livre précis, à partager sur Instagram, TikTok, Twitch, Snapchat ou Facebook.",
      "\"Récap de l'année\" : une carte à part qui résume toute ton année de lecture en un coup d'œil.",
    ],
  },
  {
    icon: User,
    title: "Profil",
    items: [
      "\"Personnaliser mon espace\" : choisis l'ambiance de couleur de ton espace (Vert d'Eau, Saumon, Rose Pâle...).",
      "\"Un jour, une citation\" : une citation différente s'affiche à l'ouverture de l'app chaque jour.",
      "Les 7 pastilles L M M J V S D s'allument en cuivre les jours où tu ouvres l'application.",
    ],
  },
];

export default function GuidePage() {
  const isAmbientDark = useAmbientDark();
  return (
    <div className="space-y-10 pb-20">
      <header className="flex items-center gap-4">
        <Link href="/profile" className="p-2 rounded-full hover:bg-white/40 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className={cn("text-3xl md:text-4xl font-headline italic flex items-center gap-3", isAmbientDark && "text-[#F5F1E8]")}>
            <HelpCircle className="h-8 w-8 text-primary/40" /> Comment utiliser Lectoria
          </h1>
          <p className="text-sm italic text-muted-foreground mt-1">Un tour rapide de toutes les fonctionnalités, expliquées simplement.</p>
        </div>
      </header>

      <Accordion type="multiple" className="space-y-3">
        {SECTIONS.map((section, i) => (
          <AccordionItem key={i} value={`section-${i}`} className="glass-card border-none bg-white/50 rounded-2xl px-5 overflow-hidden">
            <AccordionTrigger className="hover:no-underline py-5">
              <span className="flex items-center gap-3 font-headline italic text-xl">
                <section.icon className="h-5 w-5 text-copper/70 shrink-0" />
                {section.title}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-3 pb-2 pl-2">
                {section.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-sm italic text-muted-foreground leading-relaxed">
                    <span className="text-copper shrink-0">✦</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <p className="text-center text-[10px] italic text-muted-foreground/60 pt-4">
        <Sparkles className="h-3 w-3 inline mr-1.5" />
        Ce guide est mis à jour à la main à chaque nouvelle fonctionnalité importante.
      </p>
    </div>
  );
}
