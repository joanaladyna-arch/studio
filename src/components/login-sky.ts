/**
 * Ciel de la fenêtre de connexion : bancs de nuages (formes tirées des illustrations de Joana)
 * et étoiles. Le jour les nuages sont blancs et doux, le soir ils passent en bleus profonds.
 * Repère : celui de la fenêtre (viewBox 900 × 780).
 */

/** Forme de nuage (illustration fournie), réutilisée par les bancs de nuages. */
export const CLOUD_DEF = `<path id="ls-cb" d="M2104.0,1575.7c-211.0,90.3-457.3,93.8-671.8,12.3 c-64.0,40.2-129.7,77.6-200.0,104.8c-99.9,38.7-211.4,56.1-315.1,28.8 c-86.0-22.7-165.2-80.0-205.7-158.1c-27.0,25.6-59.4,45.5-95.5,53.6 c-49.1,11.0-105.4-2.9-137.1-42.1c-23.1-28.6-28.9-70.8-15.2-104.1 c-28.3-6.3-55.2-18.2-78.5-35.6c-73.1-54.7-104.0-159.5-72.2-245.2 c34.1-92.2,129.5-150.5,226.2-168.1c90.8-16.4,183.9-3.1,275.3,12.0 c38.1-112.2,124.0-209.0,235.2-249.4c126.5-46.0,281.6-11.0,367.3,92.8 c60.0,72.8,78.6,177.2,52.4,266.8c44.5-15.2,94.2-15.5,138.0,1.9c41.1,16.4,75.1,47.9,97.2,86.3 c21.9-2.0,44.1-0.9,65.7,3.9c57.3,13.1,109.1,56.8,122.4,114.1c4.8,20.8,3.5,42.8-2.6,63.3 c61.5-29.0,131.2-40.7,198.6-31.5c50.3,6.8,107.5,35.0,111.3,85.7 C2203.7,1519.6,2151.2,1555.5,2104.0,1575.7L2104.0,1575.7z M2104.0,1575.7"/>`;

/** Trois bancs de nuages superposés, posés à l'horizon (derrière les collines). */
export const CLOUD_BANKS_HTML = `<use href="#ls-cb" class="ls-bank ls-bank-1" transform="translate(-87.4 319.2) scale(0.1579)"/><use href="#ls-cb" class="ls-bank ls-bank-1" transform="translate(142.6 319.2) scale(0.1579)"/><use href="#ls-cb" class="ls-bank ls-bank-1" transform="translate(372.6 319.2) scale(0.1579)"/><use href="#ls-cb" class="ls-bank ls-bank-1" transform="translate(602.6 319.2) scale(0.1579)"/><use href="#ls-cb" class="ls-bank ls-bank-2" transform="translate(18.9 375.3) scale(0.1368)"/><use href="#ls-cb" class="ls-bank ls-bank-2" transform="translate(238.9 375.3) scale(0.1368)"/><use href="#ls-cb" class="ls-bank ls-bank-2" transform="translate(458.9 375.3) scale(0.1368)"/><use href="#ls-cb" class="ls-bank ls-bank-2" transform="translate(678.9 375.3) scale(0.1368)"/><use href="#ls-cb" class="ls-bank ls-bank-3" transform="translate(-46.3 422.4) scale(0.1211)"/><use href="#ls-cb" class="ls-bank ls-bank-3" transform="translate(153.7 422.4) scale(0.1211)"/><use href="#ls-cb" class="ls-bank ls-bank-3" transform="translate(353.7 422.4) scale(0.1211)"/><use href="#ls-cb" class="ls-bank ls-bank-3" transform="translate(553.7 422.4) scale(0.1211)"/><use href="#ls-cb" class="ls-bank ls-bank-3" transform="translate(743.7 422.4) scale(0.1211)"/>`;

/** Étoile à 5 branches centrée en (cx, cy). */
export function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.44;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}
