import { NextRequest, NextResponse } from "next/server";

/**
 * Relaie une image externe (couverture venant de Google Books, Apple,
 * BnF, Open Library...) en la convertissant en data URI — nécessaire
 * pour l'export de la carte de partage en image : la capture (toPng)
 * passe par un canvas, et un canvas refuse de lire le contenu d'une
 * image hébergée ailleurs si ce site ne l'autorise pas explicitement
 * (restriction CORS standard du navigateur, hors de notre contrôle).
 * En la récupérant ici côté serveur d'abord, l'image capturée devient
 * "interne" à l'application et la capture fonctionne quelle que soit
 * la source d'origine de la couverture.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Lien invalide" }, { status: 400 });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: {
        // Un User-Agent de vrai navigateur plutôt qu'un nom de robot —
        // certains hébergeurs d'images (Google Books, Apple...)
        // dégradent ou bloquent silencieusement les requêtes identifiées
        // comme robots, sans renvoyer d'erreur claire pour autant.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json({ error: `Image inaccessible (code ${res.status})` }, { status: 502 });
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      // Le lien a répondu, mais avec autre chose qu'une image (souvent
      // une page d'erreur ou de blocage déguisée en réponse 200) — on
      // le signale clairement plutôt que de fabriquer une fausse image.
      return NextResponse.json({ error: "Ce lien ne renvoie pas une image valide" }, { status: 502 });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 100) {
      return NextResponse.json({ error: "Image vide ou corrompue" }, { status: 502 });
    }
    const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
    return NextResponse.json({ dataUri });
  } catch (err: any) {
    const message = err?.name === "AbortError" ? "Délai dépassé en récupérant l'image." : "Impossible de récupérer cette image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
