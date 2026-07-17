import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy vers l'API Dicolink (dictionnaire FR — définitions, synonymes)
 * Clé API à ajouter dans Vercel → Environment Variables : DICOLINK_API_KEY
 * Inscription gratuite sur dicolink.com
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mot  = (searchParams.get("mot") || "").trim();
  const type = searchParams.get("type") || "definitions"; // "definitions" | "synonymes"

  if (!mot) return NextResponse.json({ results: [] });

  const apiKey = process.env.DICOLINK_API_KEY || "";
  const url    = `https://api.dicolink.com/v1/mot/${encodeURIComponent(mot)}/${type}?limite=10`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["apikey"] = apiKey;

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(tid);

    if (!res.ok) return NextResponse.json({ results: [] });
    const data = await res.json();

    const results = Array.isArray(data)
      ? type === "synonymes"
        ? data.map((s: any) => (typeof s === "string" ? s : s.mot || s.synonyme || "")).filter(Boolean)
        : data.map((d: any) => ({ definition: d.definition || d.sens || "", nature: d.nature || "", exemple: d.exemple || "" })).filter((d: any) => d.definition)
      : [];

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
