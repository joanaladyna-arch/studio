import { getBookQuotes } from "@/lib/utils";

/**
 * Petite sélection de citations d'auteurs et penseurs du domaine public
 * (tous décédés depuis largement plus de 70 ans) — utilisée pour
 * compléter le widget "Un jour, une citation" du Profil les jours où
 * elle n'alterne pas avec une citation du Carnet de la lectrice.
 * Aucune dépendance à un service externe, aucun souci de droits.
 */
export const PUBLIC_DOMAIN_QUOTES: { text: string; author: string }[] = [
  { text: "Il n'y a qu'un bonheur dans la vie, c'est d'aimer et d'être aimé.", author: "George Sand" },
  { text: "La lecture est à l'esprit ce que l'exercice est au corps.", author: "Joseph Addison" },
  { text: "Un livre est un jardin que l'on porte dans sa poche.", author: "Proverbe arabe" },
  { text: "Il faut toujours viser la lune, car même en cas d'échec, on atterrit dans les étoiles.", author: "Oscar Wilde" },
  { text: "La vie est un mystère qu'il faut vivre, et non un problème à résoudre.", author: "Gandhi" },
  { text: "On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux.", author: "Antoine de Saint-Exupéry" },
  { text: "La curiosité est un des plus grands moteurs de l'esprit humain.", author: "Voltaire" },
  { text: "La beauté est une promesse de bonheur.", author: "Stendhal" },
  { text: "Aimer, ce n'est pas se regarder l'un l'autre, c'est regarder ensemble dans la même direction.", author: "Antoine de Saint-Exupéry" },
  { text: "Il ne suffit pas d'avoir l'esprit bon, mais le principal est de l'appliquer bien.", author: "René Descartes" },
  { text: "Les livres sont les abeilles qui portent le pollen fécondant d'un esprit à un autre.", author: "James Russell Lowell" },
  { text: "Tout ce que je sais, c'est que je ne sais rien.", author: "Socrate" },
  { text: "Ce que l'on conçoit bien s'énonce clairement.", author: "Nicolas Boileau" },
  { text: "Il n'y a pas de plus grand fléau que la médiocrité érigée en système.", author: "Victor Hugo" },
  { text: "Écrire, c'est une façon de parler sans être interrompu.", author: "Jules Renard" },
  { text: "Le doute est le commencement de la sagesse.", author: "Aristote" },
  { text: "La lecture nourrit l'esprit et le repose en même temps.", author: "Jules Renard" },
  { text: "On ne se lasse jamais d'aimer, on se lasse de mal aimer.", author: "Antoine de Saint-Exupéry" },
  { text: "Le style, c'est l'homme même.", author: "Buffon" },
  { text: "Vivre sans aimer n'est pas proprement vivre.", author: "Molière" },
  { text: "Un roman, c'est un miroir qu'on promène le long d'un chemin.", author: "Stendhal" },
  { text: "L'amour est la seule chose qui grandisse quand on la partage.", author: "Antoine de Saint-Exupéry" },
  { text: "Les grandes pensées viennent du cœur.", author: "Vauvenargues" },
  { text: "Le temps que tu perds pour ta rose est ce qui fait ta rose si importante.", author: "Antoine de Saint-Exupéry" },
  { text: "Il faut cultiver notre jardin.", author: "Voltaire" },
  { text: "Rien ne se perd, rien ne se crée, tout se transforme.", author: "Antoine Lavoisier" },
  { text: "Le bonheur n'est pas une gare où l'on arrive, mais une manière de voyager.", author: "Marcel Proust" },
  { text: "Il faut être toujours ivre. Tout est là.", author: "Charles Baudelaire" },
  { text: "Le seul véritable voyage, ce ne serait pas d'aller vers de nouveaux paysages, mais d'avoir d'autres yeux.", author: "Marcel Proust" },
  { text: "La lecture est une amitié.", author: "Marcel Proust" },
  { text: "Les livres nous font partir sans qu'on bouge de place.", author: "Victor Hugo" },
  { text: "Un livre est un ami qui ne trompe jamais.", author: "Victor Hugo" },
  { text: "Ceux qui vivent, ce sont ceux qui luttent.", author: "Victor Hugo" },
  { text: "Il n'est pas certain que tout soit incertain.", author: "Blaise Pascal" },
  { text: "Le cœur a ses raisons que la raison ne connaît point.", author: "Blaise Pascal" },
  { text: "L'homme n'est qu'un roseau, le plus faible de la nature, mais c'est un roseau pensant.", author: "Blaise Pascal" },
];

export type DailyQuote = { text: string; author: string; isOwn: boolean };

/**
 * Citation du jour, partagée entre la fenêtre d'ouverture (Accueil) et
 * tout autre usage futur. Alterne entre les citations déjà enregistrées
 * par la lectrice sur ses livres (champ favoriteQuote, même source que
 * Journal > Carnet de Citations), la petite sélection ci-dessus, et les
 * citations proposées par la communauté puis validées par
 * l'administratrice (voir quote-submissions-queue.tsx — `communityQuotes`
 * vient d'une lecture de `quoteSubmissions` où status == "approved").
 * Index calculé à partir du jour de l'année : stable toute la journée,
 * change automatiquement à minuit, sans tâche planifiée nécessaire.
 */
export function getDailyQuote(booksRaw: any[], communityQuotes: { text: string; author: string }[] = []): DailyQuote | null {
  const citationPool: DailyQuote[] = (booksRaw || [])
    .flatMap((b: any) => getBookQuotes(b).map((text) => ({
      text,
      author: `${b.title || ""}${b.author ? " — " + b.author : ""}`,
      isOwn: true,
    })));
  const pool: DailyQuote[] = [
    ...citationPool,
    ...PUBLIC_DOMAIN_QUOTES.map((q) => ({ ...q, isOwn: false })),
    ...communityQuotes.map((q) => ({ ...q, isOwn: false })),
  ];
  if (pool.length === 0) return null;
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86400000);
  return pool[dayOfYear % pool.length];
}
