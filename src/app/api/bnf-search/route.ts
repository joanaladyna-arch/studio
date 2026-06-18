import { NextRequest, NextResponse } from "next/server";

/**
 * Route API serveur qui interroge le Catalogue général de la BnF
 * (Bibliothèque nationale de France) via son service public SRU,
 * gratuit et sans authentification.
 *
 * Pourquoi côté serveur et pas directement depuis le navigateur :
 * 1. Le service ne renvoie que du XML (pas de JSON), plus simple à
 *    traiter ici qu'en JS navigateur (pas de DOMParser fiable côté
 *    Node, on utilise donc une extraction par expressions régulières).
 * 2. Un appel direct depuis le navigateur risquerait d'être bloqué par
 *    la politique CORS du service (non garantie pour un usage front),
 *    ce qui ferait échouer cette source pour 100% des utilisatrices.
 *    En passant par notre propre route, le navigateur n'appelle que
 *    notre domaine ; c'est notre serveur qui parle à la BnF.
 *
 * Pourquoi cette source : le dépôt légal impose à tout éditeur français
 * de déposer chaque livre publié à la BnF. Ce catalogue est donc, en
 * théorie, exhaustif pour les maisons françaises — y compris les petites
 * maisons de romance/dark romance (BMR, Nox, Chatterley, Hugo, &H...)
 * que Google Books et Open Library référencent de façon très incomplète.
 *
 * Échec systématiquement silencieux (tableau vide) : cette source est un
 * bonus en plus de Google Books / Open Library / la base Lectoria, jamais
 * un point de blocage. Si la BnF ne répond pas ou change son format, les
 * autres sources continuent de fonctionner normalement.
 */

const BNF_SRU_URL = "https://catalogue.bnf.fr/api/SRU";

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "") // retire d'éventuelles balises imbriquées résiduelles
    .replace(/\s+/g, " ")
    .trim();
}

function extractAll(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  const out: string[] = [];
  let m;
  while ((m = re.exec(block)) !== null) {
    const val = decodeXmlEntities(m[1]);
    if (val) out.push(val);
  }
  return out;
}

function extractFirst(block: string, tag: string): string {
  return extractAll(block, tag)[0] || "";
}

/**
 * Les notices d'autorité de la BnF nomment les créateurs au format
 * "Nom, Prénom (dates). Rôle" (ex: "Lauren, Christina. Auteur du texte",
 * "Roméo, Léna. Traducteur"). Le rôle, après le premier point, DOIT être
 * retiré avant d'inverser nom/prénom — sinon il se retrouve injecté en
 * plein milieu du nom affiché (ex: "Christina. Auteur du texte Lauren").
 */
function normalizeAuthorName(raw: string): string {
  // On retire d'abord la parenthèse de dates — qui peut elle-même
  // contenir des points (ex: "1986-...." pour une personne encore en
  // vie) — AVANT de chercher le séparateur de rôle, sinon le split sur
  // "." tronque le nom au milieu de cette parenthèse.
  const withoutDates = raw.replace(/\s*\([^)]*\)/, "").trim();
  const namePart = withoutDates.split(".")[0].trim();
  const parts = namePart.split(",");
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    return `${parts[1].trim()} ${parts[0].trim()}`;
  }
  return namePart;
}

/** Détecte si un créateur BnF est crédité comme traducteur·rice plutôt qu'auteur·e. */
function isTranslatorRole(raw: string): boolean {
  return /traduct/i.test(raw);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get("q") || "").trim();
  const type = searchParams.get("type") || "general"; // "author" | "isbn" | "publisher" | "general"

  if (!qRaw) {
    return NextResponse.json({ results: [] });
  }

  // On retire les guillemets de la valeur recherchée : leur présence
  // casserait la syntaxe de la requête CQL ci-dessous.
  const q = qRaw.replace(/"/g, "'");

  let cql = "";
  if (type === "isbn") {
    cql = `bib.isbn all "${q}"`;
  } else if (type === "author") {
    cql = `bib.author all "${q}"`;
  } else if (type === "publisher") {
    cql = `bib.publisher all "${q}"`;
  } else {
    cql = `(bib.title all "${q}") or (bib.author all "${q}")`;
  }

  const url = `${BNF_SRU_URL}?version=1.2&operation=searchRetrieve&query=${encodeURIComponent(cql)}&recordSchema=dublincore&maximumRecords=20`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const xml = await res.text();
    const recordBlocks = xml.match(/<srw:record>([\s\S]*?)<\/srw:record>/g) || [];

    const results = recordBlocks
      .map((block) => {
        // Le champ titre BnF inclut parfois la mention de responsabilité
        // après un " / " (convention catalographique standard, ex: "Nos
        // âmes tourmentées / Morgane Moncomble") — ce qui dupliquerait
        // le nom de l'auteur, déjà affiché séparément, dans le titre.
        const titleRaw = extractFirst(block, "dc:title");
        const title = titleRaw.split(" / ")[0].trim();
        // Les traducteurs sont des dc:creator à part, marqués par leur
        // rôle ; on les sépare des véritables auteurs du texte.
        const rawCreators = extractAll(block, "dc:creator");
        const creators = rawCreators.filter((c) => !isTranslatorRole(c)).map(normalizeAuthorName);
        const translators = rawCreators.filter((c) => isTranslatorRole(c)).map(normalizeAuthorName);
        const publisher = extractFirst(block, "dc:publisher").replace(/^Editeur\s*:?\s*/i, "");
        const date = extractFirst(block, "dc:date");
        const language = extractFirst(block, "dc:language");
        const subjects = extractAll(block, "dc:subject").slice(0, 5);
        const identifiers = extractAll(block, "dc:identifier");
        // Pas toutes les notices BnF n'ont un résumé catalogué (zone
        // UNIMARC 330) — quand il existe, il est précieux car
        // généralement rédigé en français, ce que Google Books ne
        // garantit jamais pour un ISBN donné.
        const description = extractFirst(block, "dc:description");
        const isbnRaw = identifiers.find((id) => /97[89][\d\-X]{9,16}/i.test(id));
        const isbn = isbnRaw ? (isbnRaw.match(/97[89][\d\-X]{9,16}/i) || [""])[0].replace(/-/g, "") : "";

        return {
          id: `bnf-${isbn || title}-${creators[0] || ""}`.slice(0, 140),
          title: title || "",
          author: creators.length ? creators.join(", ") : "",
          translator: translators.length ? translators.join(", ") : "",
          publisher,
          publishedDate: (date.match(/\d{4}/) || [])[0] || date,
          publicationDate: (date.match(/\d{4}/) || [])[0] || date,
          language: /^fre?$/i.test(language) ? "Français" : language,
          genres: subjects,
          isbn,
          cover: "",
          description,
          source: "bnf",
        };
      })
      .filter((b) => b.title && b.author);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
