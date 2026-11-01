"use client";

import Link from "next/link";
import { ArrowLeft, HelpCircle, Library, Plus, Heart, BookOpen, BarChart3, Share2, Feather, Sparkles, Bell, Smartphone, Eye, Settings } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    icon: Smartphone,
    title: "Installer Lectoria & compatibilité",
    items: [
      "Lectoria fonctionne dans le navigateur de ton iPhone, ton téléphone Android, ta tablette et ton ordinateur : l'affichage s'adapte tout seul à la taille de l'écran.",
      "Sur téléphone et tablette, la navigation se trouve en bas de l'écran ; sur ordinateur, elle passe en haut. La cloche des notifications est toujours accessible.",
      "iPhone / iPad : ouvre Lectoria dans Safari, touche le bouton Partager puis \"Sur l'écran d'accueil\". Android : menu du navigateur puis \"Installer l'application\" ou \"Ajouter à l'écran d'accueil\".",
      "✦ Nouveau — Installée sur l'écran d'accueil, Lectoria s'ouvre comme une vraie application, en plein écran, avec son icône Plume.",
      "À la connexion, la page d'accueil suit les saisons : le décor et le logo changent au fil de l'année. Le petit interrupteur en haut passe de \"Lecture du soir\" (mode sombre) à la lumière du jour.",
    ],
  },
  {
    icon: Library,
    title: "Bibliothèque",
    items: [
      "Tes livres sont rangés par onglets, juste sous \"Ma Bibliothèque\" : Mois prochain, En cours, PAL, Lu, Wishlist et DNF — un seul onglet s'affiche à la fois.",
      "\"Surprends-moi\" (le petit dé, à côté du bouton \"Ajouter\") tire un livre au hasard dans ta PAL quand tu ne sais pas quoi lire ensuite.",
      "Le bouton \"Sélectionner\" permet de cocher plusieurs livres à la fois, par exemple pour les retirer de tes objectifs de lecture.",
      "Onglet \"En cours\" : la carte \"Lecture Actuelle\" avec couverture, barre de progression et bouton \"Reprendre le voyage\".",
      "Onglet \"Lu\" : le mois en cours reste en liste ouverte ; les mois précédents sont rangés dans des boîtes d'archive — clique sur une boîte pour retrouver la note, la citation retenue et l'avis de chaque livre.",
      "Onglet \"Wishlist\" : tes envies de lecture sont accrochées sur une petite corde à linge, comme des photos.",
      "✦ Nouveau — \"Capturer\" (onglets Wishlist et PAL) : crée une image (JPG, PNG) ou un PDF de toute ta liste, avec ou sans les couvertures. Les grandes listes sont découpées en plusieurs images lisibles, prêtes à être envoyées à un proche ou partagées sur les réseaux.",
      "Onglet PAL : un aperçu du futur bloc Plume+ \"Ordre de ta PAL\" est visible mais pas encore activable — bientôt disponible.",
    ],
  },
  {
    icon: Plus,
    title: "Ajouter un livre",
    items: [
      "Cherche par titre, auteur ou éditeur — les résultats viennent de Google Books et Apple Books.",
      "\"Ma précédente recherche\" relance en un clic ta dernière recherche.",
      "Une fois le livre choisi, indique son statut (En cours, PAL, Lu...) et son format (papier, ebook, audio...).",
      "Le bouton avec l'appareil photo scanne le code-barres d'un livre physique pour l'ajouter instantanément — une torche manuelle s'allume si ton téléphone la supporte, et l'appli bascule automatiquement en saisie manuelle si le scan a du mal.",
      "Livre introuvable dans les résultats ? Ajoute-le toi-même avec ses informations, ou signale-le à l'administratrice pour qu'elle l'ajoute au catalogue. Tu seras prévenue dans la cloche dès qu'il est ajouté.",
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
      "\"Lu par X lectrices Lectoria\" : sous le titre, indique combien de lectrices ont terminé ce livre, avec un raccourci direct vers leurs avis.",
      "En cours de lecture, indique directement la page où tu t'es arrêtée : le pourcentage se calcule tout seul dès que le nombre total de pages est connu.",
      "Pour changer la couverture : survole-la avec la souris (ordinateur) ou regarde le bouton \"Changer\" au bas de la couverture (téléphone et tablette).",
      "✦ Nouveau — \"Capturer un avis\" (onglet Mon Journal) : choisis ce que tu veux montrer (avis, citation du livre, note Spicy, palme de classement). La page de capture découpe tout automatiquement et l'exporte en JPG, PNG ou PDF.",
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
    title: "Journal de bord",
    items: [
      "✦ Nouveau — Le journal est rangé en 5 onglets, une page par onglet : Notes au fil de l'eau, Nuage des mots, Carnet de citations, Mes avis & réflexions et Mes recommandations.",
      "\"Notes au fil de l'eau\" : notes rapides liées à un livre en cours ou dans ta PAL, avec catégories (Citation, Réflexion, Personnage, Intrigue, Émotion) et humeur (😍 😤 😭 😱). Vue \"Par livre\" et export PDF.",
      "\"Nuage des mots\" : un nuage visuel construit automatiquement depuis tes notes, citations et avis. Ajoute tes propres mots, supprime ceux qui ne t'intéressent pas. Export PDF.",
      "\"Carnet de citations\" : toutes les citations favorites de tes fiches livres. Un cœur sur la citation du jour (à l'ouverture de l'appli) l'ajoute ici, et tu peux proposer une citation à toute la communauté (validée par l'administratrice avant diffusion).",
      "\"Mes avis & réflexions\" : retrouve tous tes avis. Coche celui que tu veux partager puis touche \"Capturer un avis\" : la page de capture s'ouvre.",
      "\"Mes recommandations\" : les livres auxquels tu as attribué une Palme, avec un bouton Partager.",
    ],
  },
  {
    icon: Sparkles,
    title: "Lounge",
    items: [
      "✦ Nouveau — Le Lounge remplace l'ancien onglet Actualités. Il réunit quatre onglets : Communauté, Recommandation, Fil et Sorties.",
      "\"Communauté\" : suis d'autres lectrices et retrouve les avis qu'elles ont choisi de partager. Rien n'est visible par défaut : active \"Visible dans la communauté\" dans ton profil pour apparaître dans l'annuaire.",
      "\"Recommandation\" : pose une question à la communauté (\"Je cherche un roman feel-good…\", 140 caractères maximum, avec des étiquettes) et reçois des propositions de livres du catalogue. Tu peux aussi répondre aux demandes des autres.",
      "\"Fil\" : l'activité des lectrices qui l'ont activé (livres terminés, avis publiés…).",
      "\"Sorties\" : les nouveautés des auteurs et éditeurs que tu suis, et la mise en avant des parutions de la semaine.",
      "Un contenu te paraît inapproprié ? Utilise \"Signaler\" : seule l'administratrice voit les signalements.",
    ],
  },
  {
    icon: Bell,
    title: "Notifications en temps réel",
    items: [
      "✦ Nouveau — La cloche te prévient en direct, sans recharger la page : un message s'affiche en haut ou en bas de l'écran dès qu'une notification arrive, avec un bouton \"Voir\".",
      "Elle t'avertit quand : un livre signalé comme introuvable est ajouté, une actualité paraît pour un auteur ou un éditeur que tu suis, l'appli reçoit une mise à jour importante, quelqu'un répond à ta demande de recommandation, ou une lectrice commence à te suivre.",
      "Un point rouge apparaît sur la cloche tant qu'une notification n'a pas été lue. \"Tout marquer lu\" les efface d'un coup.",
      "✦ Nouveau — Alertes même quand Lectoria est fermée : en bas de la cloche, active \"Alertes sur cet appareil\" et accepte la demande du navigateur. À faire une fois sur chaque appareil.",
      "Sur iPhone et iPad, ces alertes ne fonctionnent que si Lectoria est installée sur l'écran d'accueil (voir la première section). Si tu as refusé la demande, autorise les notifications dans les réglages de ton navigateur.",
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
    icon: Eye,
    title: "Profil & profil visible",
    items: [
      "Ton profil rassemble ta photo, tes badges et médailles, tes statistiques et tes citations. Le badge \"Profil visible\" / \"Profil bloqué\" à côté de ton nom bascule ta visibilité dans la communauté en un seul clic.",
      "✦ Nouveau — \"Mon profil visible\" : crée un lien de partage en lecture seule pour inviter quelqu'un à découvrir ton profil de lectrice, sans compte nécessaire.",
      "\"Modifier mon profil visible\" (icône à vis) : choisis ce que tu montres — ton dernier avis, tes livres préférés, tes citations, ta wishlist et ta PAL en vitrine défilante — et l'aspect du profil (Crème, Nuit, ou la saison en cours). Tu peux couper le lien à tout moment.",
      "Le contenu de la vitrine reste à jour automatiquement : pas besoin de repartager le lien.",
      "\"Un jour, une citation\" : une citation différente s'affiche à l'ouverture de l'app chaque jour.",
      "Les 7 pastilles L M M J V S D s'allument en cuivre les jours où tu ouvres l'application.",
    ],
  },
  {
    icon: Settings,
    title: "Réglages & raccourcis",
    items: [
      "✦ Nouveau — Le menu \"Réglages\" (sur ton profil) regroupe : Passeport de lectrice, Bilan de lecture, Exporter vers les réseaux, Communauté de lectrices et ce guide.",
      "\"Personnaliser mon espace\" : choisis l'ambiance de couleur de ton espace (Vert d'Eau, Saumon, Rose Pâle...).",
      "Sur l'accueil, les Raccourcis t'envoient en un clic vers ta Bibliothèque, tes Coups de Cœur, ta Wishlist et tes Recommandations.",
      "Un souci ou une idée ? Le bouton de contact écrit directement à l'administratrice.",
    ],
  },
  {
    icon: Share2,
    title: "Partage & Réseaux sociaux",
    items: [
      "Génère une carte élégante pour un livre précis, à partager sur Instagram, TikTok, Twitch, Snapchat ou Facebook.",
      "\"Récap de l'année\" : une carte à part qui résume toute ton année de lecture en un coup d'œil.",
      "Les captures d'avis, de wishlist et de PAL s'exportent en JPG, PNG ou PDF, puis se partagent depuis le menu de partage de ton appareil.",
    ],
  },
];

export default function GuidePage() {
  const isAmbientDark = useAmbientDark();
  return (
    <div className="space-y-10 pb-20">
      <header className="flex items-center gap-4 pr-14 lg:pr-0">
        <Link href="/profile" className="p-2 rounded-full hover:bg-white/40 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className={cn("text-3xl md:text-4xl font-headline italic flex items-center gap-3", isAmbientDark && "text-[#F5F1E8]")}>
            <HelpCircle className="hidden sm:block h-8 w-8 shrink-0 text-primary/40" /> Comment utiliser Lectoria
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
