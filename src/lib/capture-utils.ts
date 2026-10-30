/**
 * Briques communes aux captures (wishlist, PAL, avis) : couleurs, récupération
 * des couvertures en data URI (sans quoi le canvas les perd), polices
 * embarquées, et export des feuilles en PDF / JPG / PNG.
 */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

/* ---------- couvertures : récupération avant capture ---------- */

export async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function decodes(dataUri: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth > 8 && img.naturalHeight > 8); // écarte les faux visuels 1×1
    img.onerror = () => resolve(false);
    img.src = dataUri;
  });
}

export async function fetchCover(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    let dataUri: string | null = null;
    if (url.startsWith("data:")) {
      dataUri = url;
    } else if (url.startsWith("/")) {
      const res = await fetch(url);
      if (res.ok) dataUri = await blobToDataUri(await res.blob());
    } else {
      const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      dataUri = data?.dataUri || null;
    }
    return dataUri && (await decodes(dataUri)) ? dataUri : null;
  } catch {
    return null;
  }
}

/* ---------- polices embarquées ---------- */

// html-to-image ne sait pas lire la feuille de style Google Fonts (accès
// refusé) et, sans police embarquée, la capture retombe sur une police
// par défaut. On construit donc nous-mêmes le CSS des polices (sous-ensemble
// latin) avec les fichiers en data URI, avec un délai maximal par requête
// pour qu'une connexion lente ne bloque jamais l'export.
let fontCssPromise: Promise<string> | null = null;

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function getFontEmbedCSS(): Promise<string> {
  if (fontCssPromise) return fontCssPromise;
  fontCssPromise = (async () => {
    try {
      const link = document.querySelector<HTMLLinkElement>('link[href*="fonts.googleapis.com/css"]');
      if (!link) return "";
      const css = await (await fetchWithTimeout(link.href)).text();
      const blocks = Array.from(css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)).filter((m) => m[1] === "latin");
      const out = await Promise.all(
        blocks.map(async (m) => {
          let block = m[2];
          const urls = Array.from(block.matchAll(/url\((https:[^)]+)\)/g));
          for (const u of urls) {
            try {
              const res = await fetchWithTimeout(u[1]);
              block = block.replace(u[1], await blobToDataUri(await res.blob()));
            } catch {
              return "";
            }
          }
          return block;
        })
      );
      return out.join("\n");
    } catch {
      return "";
    }
  })();
  return fontCssPromise;
}


export type OutFile = { blob: Blob; filename: string; type: string };

/**
 * Capture des nœuds déjà montés hors écran : un PDF (une page A4 par nœud,
 * en JPEG pour rester léger) ou une image JPG/PNG par nœud.
 */
export async function exportNodes(args: {
  nodes: HTMLElement[];
  format: "pdf" | "jpg" | "png";
  solid: string;
  fileBase: string;
  sheetWidth: number;
}): Promise<OutFile[]> {
  const { nodes, format, solid, fileBase, sheetWidth } = args;
  await Promise.all(
    nodes.flatMap((n) => Array.from(n.querySelectorAll("img")).map((im) => (im as HTMLImageElement).decode().catch(() => undefined)))
  );
  const { toPng, toJpeg } = await import("html-to-image");
  const fontEmbedCSS = await getFontEmbedCSS();
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const [r, g, b] = hexToRgb(solid);
    for (let i = 0; i < nodes.length; i++) {
      if (i > 0) doc.addPage();
      doc.setFillColor(r, g, b);
      doc.rect(0, 0, 210, 297, "F");
      const img = await toJpeg(nodes[i], { pixelRatio: 2, quality: 0.92, cacheBust: true, fontEmbedCSS, backgroundColor: solid });
      const w = nodes[i].offsetWidth;
      const h = nodes[i].offsetHeight;
      const k = Math.min(210 / w, 297 / h);
      doc.addImage(img, "JPEG", (210 - w * k) / 2, 0, w * k, h * k, undefined, "FAST");
    }
    return [{ blob: doc.output("blob"), filename: `${fileBase}.pdf`, type: "application/pdf" }];
  }
  const opts = { pixelRatio: 1080 / sheetWidth, cacheBust: true, fontEmbedCSS, backgroundColor: solid };
  const files: OutFile[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const dataUrl = format === "jpg" ? await toJpeg(nodes[i], { ...opts, quality: 0.92 }) : await toPng(nodes[i], opts);
    const blob = await (await fetch(dataUrl)).blob();
    const suffix = nodes.length > 1 ? `-${i + 1}sur${nodes.length}` : "";
    files.push({ blob, filename: `${fileBase}${suffix}.${format}`, type: format === "jpg" ? "image/jpeg" : "image/png" });
  }
  return files;
}
