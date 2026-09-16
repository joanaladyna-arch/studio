import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Initialisation du SDK Admin Firebase, utilisée uniquement côté serveur
 * (routes API / tâches planifiées) — jamais exposée au navigateur.
 *
 * La clé de service est lue depuis la variable d'environnement
 * FIREBASE_SERVICE_ACCOUNT_KEY (le contenu JSON complet du fichier
 * téléchargé depuis Firebase Console → Paramètres du projet → Comptes
 * de service), configurée dans Vercel → Settings → Environment
 * Variables. Elle n'est jamais commitée dans le dépôt.
 */
/**
 * Erreur distincte d'un jeton invalide : sans elle, les routes appelantes
 * ne peuvent pas distinguer "la clé de service n'est pas configurée côté
 * serveur" (à corriger dans Vercel, rien à voir avec la session de
 * l'administratrice) d'un vrai jeton expiré/invalide — et renvoyaient
 * toutes les deux le même "Token invalide" trompeur.
 */
export class AdminConfigError extends Error {}

let adminApp: App | null = null;

export function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    throw new AdminConfigError(
      "FIREBASE_SERVICE_ACCOUNT_KEY manquante — ajoute-la dans Vercel (Project Settings → Environment Variables) avec le contenu JSON complet de la clé de service Firebase."
    );
  }

  // .trim() : un copier-coller depuis Vercel ou un éditeur ajoute parfois
  // un retour à la ligne ou une espace avant/après, invisible à l'œil mais
  // suffisant pour faire échouer JSON.parse.
  const cleanedKey = rawKey.trim();
  let serviceAccount: unknown;
  try {
    serviceAccount = JSON.parse(cleanedKey);
  } catch (err) {
    // Cause fréquente et invisible à l'œil : des guillemets courbes
    // (“ ”) substitués aux guillemets droits (") par une appli qui
    // "corrige" le texte à l'ouverture du fichier (TextEdit en mode
    // texte enrichi, Pages, Notes...) — le JSON a alors l'air identique
    // en le relisant, mais n'est plus du JSON valide.
    const smartQuoteHint = /[“”‘’]/.test(cleanedKey)
      ? " Des guillemets courbes (“ ”) ont été repérés à la place de guillemets droits (\") — probablement introduits par une appli qui « corrige » le texte à l'ouverture du fichier (TextEdit en mode texte enrichi, Pages, Notes...). Réouvre le .json original dans un éditeur de texte brut et recopie-le."
      : "";
    throw new AdminConfigError(
      `FIREBASE_SERVICE_ACCOUNT_KEY invalide — le contenu doit être le JSON complet de la clé de service Firebase, sans modification. Détail : ${(err as Error).message}.${smartQuoteHint}`
    );
  }

  adminApp = initializeApp({
    credential: cert(serviceAccount as any),
  });
  return adminApp;
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

/**
 * Import dynamique (pas de `import { getAuth } from "firebase-admin/auth"`
 * en haut du fichier) : ce sous-module tire jwks-rsa → jose, un paquet ESM
 * que require() ne sait pas charger dans l'environnement serverless
 * Vercel (ERR_REQUIRE_ESM). Un import statique fait planter TOUTES les
 * routes qui importent quoi que ce soit de ce fichier — y compris le
 * cron, qui n'utilise même pas l'auth — puisque Node évalue tous les
 * imports d'un module au chargement, qu'ils soient appelés ou non. En
 * important dynamiquement uniquement ici, seule la route qui appelle
 * réellement getAdminAuth() (vision-import) charge ce sous-module.
 */
export async function getAdminAuth() {
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(getAdminApp());
}
