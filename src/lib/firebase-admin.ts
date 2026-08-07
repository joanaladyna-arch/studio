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
let adminApp: App | null = null;

export function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY manquante — ajoute-la dans Vercel (Project Settings → Environment Variables) avec le contenu JSON complet de la clé de service Firebase."
    );
  }

  const serviceAccount = JSON.parse(rawKey);
  adminApp = initializeApp({
    credential: cert(serviceAccount),
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
