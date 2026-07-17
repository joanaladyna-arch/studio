"use client";

import Link from "next/link";
import { ArrowLeft, HelpCircle, Library, Plus, User, Heart, Newspaper, BookOpen, BarChart3, Users, Share2, Feather, Sparkles, MessageCircle, Cloud } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { cn } from "@/lib/utils";

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
      "\"Ma Note\" : ta note personnelle sur 5 étoiles. Le petit (i) explique la différence avec la Palme.",
      "\"Mon Rang\" (la Palme) : réservé à tes tout meilleurs souvenirs de lecture — plus rare et plus précieux qu'une simple bonne note.",
      "\"Service de presse\" : coche cette case pour un livre reçu en service de presse — un ruban SP apparaît sur sa couverture.",
      "\"Pépite Incontournable\" : recommande ce livre à la communauté — il apparaît sur ton profil public.",
      "Le bouton \"Suivre\" à côté de la Maison d'édition permet d'être alertée des nouveautés de cet éditeur.",
      "✦ Nouveau — \"Exporter l'avis\" dans l'onglet Mon Journal : génère une carte stylisée à partager sur Instagram ou TikTok (4 templates, palette de couleurs, texte libre, export PNG ou PDF).",
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
      "✦ Nouveau — \"Mes notes de lecture\" : retrouve toutes tes notes avec la possibilité de les catégoriser (Citation, Réflexion, Personnage, Intrigue, Émotion) et d'ajouter une humeur (😍 😤 😭 😱). Vue \"Par livre\" pour regrouper par roman. Export PDF de toutes tes notes.",
      "✦ Nouveau — \"Nuage des mots\" : un nuage visuel construit automatiquement depuis toutes tes notes, citations et avis. Ajoute tes propres mots manuellement, supprime ceux qui ne t'intéressent pas. Export PDF.",
      "\"Mon Avis & Réflexions\" : retrouve tous tes avis rédigés depuis les fiches livres.",
      "\"Carnet de Citations\" : toutes les citations favorites que tu as notées sur chaque fiche livre.",
      "\"Mes Recommandations\" : les livres auxquels tu as attribué une Palme, avec un bouton Partager.",
    ],
  },
  {
    icon: BarChart3,
    title: "Bilan de lecture",
    items: [
      "Un tableau de bord complet : livres lus par mois, répartition des genres, objectif annuel et progression.",
      "\"Récap de l'année\" : une carte visuelle à exporter et partager.",
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
      "✦ Nouveau — \"Exporter l'avis\" depuis la fiche d'un livre (onglet Mon Journal) : 4 templates (Polaroid, Journal, Minimal, Bold), palette de couleurs personnalisable, texte libre repositionnable, export en PNG ou PDF.",
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
                    <span className="text-copper shrink-0">{item.startsWith("✦ Nouveau") ? "🆕" : "✦"}</span>
                    <span>{item.startsWith("✦ Nouveau") ? item.slice(10) : item}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <p className="text-center text-[10px] italic text-muted-foreground/60 pt-4">
        <Sparkles className="h-3 w-3 inline mr-1.5" />
        Ce guide est mis à jour à chaque nouvelle fonctionnalité importante.
      </p>
    </div>
  );
}
