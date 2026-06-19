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
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LectoriaBot/1.0)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return NextResponse.json({ error: "Image inaccessible" }, { status: 502 });
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
    return NextResponse.json({ dataUri });
  } catch (err) {
    return NextResponse.json({ error: "Impossible de récupérer cette image." }, { status: 500 });
  }
}
