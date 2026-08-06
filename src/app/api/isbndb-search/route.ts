import { NextRequest, NextResponse } from "next/server";

/**
 * Route API serveur qui interroge ISBNdb (https://isbndb.com) pour
 * compléter une fiche masterBooks à partir de son ISBN.
 *
 * Pourquoi côté serveur et pas directement depuis le navigateur : la clé
 * ISBNDB_API_KEY est un secret payant (essai gratuit puis abonnement) —
 * l'exposer côté client la rendrait visible dans le bundle JS et
 * utilisable par n'importe qui. Elle ne doit donc exister que dans les
 * variables d'environnement serveur (jamais préfixée NEXT_PUBLIC_).
 *
 * Contrairement à la BnF ou Google Books (recherche par titre/auteur),
 * ISBNdb ne fonctionne ici qu'en recherche par ISBN exact — utile pour
 * compléter les champs manquants (couverture, éditeur, pages, langue,
 * date, résumé) d'une fiche qui a déjà un isbn13/isbn10, pas pour
 * découvrir un livre à partir de son seul titre.
 *
 * Échec systématiquement silencieux (results: []) : cette source est un
 * complément, jamais un point de blocage pour le reste de l'admin.
 */

function cleanIsbn(v: string): string {
  return (v || "").replace(/[-\s]/g, "").trim();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isbn = cleanIsbn(searchParams.get("isbn") || "");

  if (!isbn) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ results: [] });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(`https://api2.isbndb.com/book/${encodeURIComponent(isbn)}`, {
        headers: { Authorization: apiKey },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();
    const book = data?.book;
    if (!book) {
      return NextResponse.json({ results: [] });
    }

    const authors: string[] = Array.isArray(book.authors) ? book.authors : [];
    const rawLanguage = (book.language || "").toString().trim();

    const result = {
      title: (book.title || "").toString().trim(),
      author: authors.join(", "),
      publisher: (book.publisher || "").toString().trim(),
      // Même convention que /api/bnf-search : ne normaliser que le
      // français (langue par défaut de l'app), laisser les autres codes
      // ISBNdb (en, de, es...) tels quels plutôt que de deviner un libellé.
      language: /^fre?$/i.test(rawLanguage) ? "Français" : rawLanguage,
      publishedDate: (book.date_published || "").toString().trim(),
      pageCount: typeof book.pages === "number" ? book.pages : undefined,
      cover: (book.image || "").toString().trim(),
      description: (book.synopsis || book.excerpt || "").toString().trim(),
      isbn13: cleanIsbn(book.isbn13 || ""),
      isbn10: cleanIsbn(book.isbn10 || ""),
      source: "isbndb",
    };

    return NextResponse.json({ results: [result] });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
