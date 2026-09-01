// Listes de base des genres/tropes/thèmes. Extraites de
// src/app/library/page.tsx (qui les ré-exporte pour ne rien casser côté
// clients existants) afin de pouvoir les importer aussi depuis des
// routes API serveur (ex: enrich-book-taxonomy) sans tirer dans le
// bundle un fichier "use client".

export const GENRES_LIST = [
  "Romance contemporaine", "Dark romance", "Fantasy", "Romantasy", "New romance",
  "Young adult", "New adult", "Contemporain", "Feel-good", "Rom-com", "Chick-lit",
  "Thriller", "Thriller psychologique", "Suspense", "Policier", "Mystère",
  "Horreur", "Fantastique", "Paranormal romance", "Urban fantasy",
  "Science-fiction", "Dystopie", "Historique", "Steampunk",
  "MM Romance", "FF Romance", "Romance LGBTQ+", "Reverse harem",
  "Érotique", "Contemporaine française",
  "Drame", "Développement personnel", "Témoignage", "Biographie", "Essai",
  "Manga", "Manhwa", "Webtoon", "BD", "Roman graphique", "Poésie",
  "Cowboy romance", "Novella / Nouvelle", "Wattpad / Auto-édition",
  "Cosy mystery", "Cosy fantasy"
];

export const TROPES_LIST = [
  "Enemies to lovers", "Friends to lovers", "Slow burn", "Fake dating",
  "Forced proximity", "Grumpy x sunshine", "Second chance", "Found family",
  "Age gap", "Brother’s best friend", "Best friend’s brother", "Marriage of convenience",
  "Forbidden love", "Workplace romance", "Sports romance", "Small town",
  "Billionaire", "Mafia", "Royal romance", "Single parent", "Roommates",
  "Academic rivals", "Love triangle", "Soulmates", "Protector", "Revenge",
  "Secret identity", "Childhood friends", "Opposites attract", "He falls first",
  "She falls first", "Touch her and you die", "Héros", "Musicien"
];

// Les thèmes principaux décrivent de QUOI parle le livre sur le fond
// (sujets, contexte, propos) — à ne pas confondre avec les tropes, qui
// décrivent un schéma narratif de la relation amoureuse.
export const THEMES_LIST = [
  "Amour", "Amour possessif", "Romance érotique", "Trahison", "Secrets",
  "Espionnage", "École militaire", "Université", "Humour", "Famille",
  "Amitié", "Vengeance", "Rédemption", "Pouvoir", "Justice", "Guerre",
  "Crime organisé", "Survie", "Identité", "Deuil", "Résilience",
  "Manipulation", "Jalousie", "Liberté", "Sacrifice", "Loyauté",
  "Addiction", "Santé mentale", "Reconstruction de soi", "Littérature française",
  "Politique", "Religion et foi", "Mythologie et légendes", "Milieu artistique",
  "Milieu médical", "Adapté au cinéma", "Adapté en série/film", "Sport",
  "Voyage", "Confiance en soi", "Mariage", "Divorce", "Maternité et parentalité",
  "Richesse et pouvoir économique", "Différence culturelle", "Féminisme",
  "Nostalgie", "Destin", "Corruption", "Abus de pouvoir", "Harcèlement",
  "Narcotrafic", "Prison et incarcération", "Période historique", "Huis clos",
  "Course contre le temps",
  "Violence conjugale", "Agression / Abus", "BDSM", "Dépression",
  "Traumatisme", "Deuil amoureux", "Grossesse surprise", "Secrets de famille",
  "Harcèlement scolaire", "Harcèlement moral", "Violence psychologique",
  "Célébrité / Stardom", "Monde des affaires", "Réseaux sociaux / Influence",
  "Dark academia", "Milieu sportif professionnel", "Jeux vidéo / E-sport",
  "Monde de la musique", "Monde de la mode", "LGBTQ+",
  "Discrimination / Racisme", "Immigration / Diaspora",
  "Trigger content", "Dépendance émotionnelle", "Co-dépendance",
  "Revenge porn", "Stalking", "Monde magique / Magie"
];
