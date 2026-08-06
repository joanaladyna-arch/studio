import { NextRequest, NextResponse } from "next/server";

/**
 * Route API serveur qui interroge Hardcover (voir aussi le cron
 * detect-releases, qui utilise déjà cette API) pour compléter une fiche
 * masterBooks à partir de son titre — troisième source pour "Compléter
 * ISBN + Éditeur", après la BnF et en complément d'ISBNdb (qui lui ne
 * fonctionne qu'à partir d'un ISBN déjà connu).
 *
 * Recherche en deux temps comme pour les auteurs dans le cron : leur
 * moteur de recherche plein texte peut renvoyer un livre sans rapport
 * (il matche aussi sur les résumés), donc on revalide que le titre
 * renvoyé correspond vraiment avant d'aller chercher l'ISBN.
 *
 * Un livre a souvent plusieurs éditions (langues/formats) avec des ISBN
 * différents — on prend l'édition physique par défaut, un choix
 * raisonnable mais pas toujours la version française ; l'admin peut
 * toujours corriger manuellement après coup.
 *
 * Échec toujours silencieux (results: []) : source bonus, jamais un
 * point de blocage pour le reste de l'admin.
 */

function normalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function titleMatches(candidate: string, reference: string): boolean {
  const refWords = normalize(reference).split(" ").filter((w) => w.length > 2);
  if (refWords.length === 0) return false;
  const candidateNorm = normalize(candidate);
  const matched = refWords.filter((w) => candidateNorm.includes(w)).length;
  // Majorité des mots significatifs du titre recherché doit se retrouver
  // dans le titre candidat — tolère les sous-titres/tomes en trop sans
  // accepter un livre complètement différent.
  return matched / refWords.length >= 0.6;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "").trim();

  if (!title) {
    return NextResponse.json({ results: [] });
  }

  const token = process.env.HARDCOVER_API_TOKEN;
  if (!token) {
    return NextResponse.json({ results: [] });
  }

  const authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const headers = { "Content-Type": "application/json", Authorization: authorization };

  try {
    const searchRes = await fetch("https://api.hardcover.app/v1/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `query($q: String!) { search(query: $q, query_type: "book", per_page: 1) { results } }`,
        variables: { q: title },
      }),
    });
    if (!searchRes.ok) return NextResponse.json({ results: [] });
    const searchData = await searchRes.json();
    const hit = searchData?.data?.search?.results?.hits?.[0]?.document;
    if (!hit?.id || !hit?.title || !titleMatches(hit.title, title)) {
      return NextResponse.json({ results: [] });
    }

    const bookRes = await fetch("https://api.hardcover.app/v1/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `query($id: Int!) {
          books_by_pk(id: $id) {
            title
            default_physical_edition { isbn_13 isbn_10 publisher { name } }
          }
        }`,
        variables: { id: Number(hit.id) },
      }),
    });
    if (!bookRes.ok) return NextResponse.json({ results: [] });
    const bookData = await bookRes.json();
    const edition = bookData?.data?.books_by_pk?.default_physical_edition;
    if (!edition) return NextResponse.json({ results: [] });

    return NextResponse.json({
      results: [
        {
          title: hit.title,
          isbn13: (edition.isbn_13 || "").toString().trim(),
          isbn10: (edition.isbn_10 || "").toString().trim(),
          publisher: (edition.publisher?.name || "").toString().trim(),
          source: "hardcover",
        },
      ],
    });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
