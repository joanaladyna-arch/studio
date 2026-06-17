import { NextRequest, NextResponse } from "next/server";

/**
 * Récupère les informations d'un livre depuis un lien externe quelconque
 * (page d'achat, fiche Goodreads, site de l'éditeur...) en lisant ses
 * balises Open Graph — le même mécanisme standard qu'utilisent WhatsApp,
 * Facebook ou Messenger pour générer un aperçu de lien. Quasiment tous
 * les sites de contenu ou e-commerce les fournissent.
 */
function extractMeta(html: string, property: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*name=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

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
    const html = await res.text();

    const titleRaw = extractMeta(html, "og:title") || (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [, ""])[1] || "";
    const descriptionRaw = extractMeta(html, "og:description") || extractMeta(html, "description");
    const image = extractMeta(html, "og:image");

    return NextResponse.json({
      title: decodeEntities(titleRaw),
      description: decodeEntities(descriptionRaw),
      image: image || "",
    });
  } catch (err) {
    return NextResponse.json({ error: "Impossible de récupérer les informations de cette page." }, { status: 500 });
  }
}
