import { NextRequest, NextResponse } from "next/server";
import { cleanDescriptionHtml } from "@/lib/utils";

/**
 * Route API serveur qui interroge l'iTunes Search API d'Apple (qui
 * couvre, entre autres, le catalogue Apple Books / iBooks Store).
 * Gratuite, publique, sans authentification — environ 20 appels par
 * minute autorisés, largement suffisant pour un usage personnel.
 *
 * On passe par notre propre route plutôt qu'un appel direct depuis le
 * navigateur car Apple ne garantit pas de CORS pour ce service ; un
 * appel direct échouerait donc silencieusement pour certaines
 * visiteuses selon leur navigateur — même logique que pour la BnF.
 *
 * Échec systématiquement silencieux (tableau vide) : source bonus en
 * plus de la base Lectoria, Google Books, BnF et Open Library, jamais un
 * point de blocage.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const isIsbn = searchParams.get("isbn") === "1";

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const url = isIsbn
    ? `https://itunes.apple.com/lookup?isbn=${encodeURIComponent(q)}&country=FR`
    : `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=ebook&country=FR&limit=10`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();
    const items: any[] = data.results || [];

    const results = items
      .filter((item) => item.kind === "ebook")
      .map((item) => ({
        id: `apple-${item.trackId || item.trackName}`,
        title: item.trackName || "",
        author: item.artistName || "",
        cover: (item.artworkUrl100 || item.artworkUrl60 || "").replace(/\d+x\d+bb/, "600x600bb"),
        description: cleanDescriptionHtml(item.description || item.shortDescription || ""),
        publishedDate: (item.releaseDate || "").slice(0, 4),
        genres: item.genres || [],
        language: "",
        source: "apple",
      }))
      .filter((b) => b.title && b.author);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
