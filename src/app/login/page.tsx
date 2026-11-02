
"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  OAuthProvider,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoginScene, seasonLine } from "@/components/login-scene";
import { useSeasonalLogo } from "@/lib/seasonal-logo";

const stagger = (i: number) => ({ "--ls-i": i }) as CSSProperties;

export default function LoginPage() {
  const logoSrc = useSeasonalLogo();
  const auth = useAuth();
  const db = useFirestore();
  const { user, loading: authLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  // Récupère le résultat d'une connexion par redirection (Google/Apple sur
  // mobile, où les popups sont souvent bloquées). Au retour sur la page
  // après la redirection vers Google/Apple, ce résultat contient
  // l'utilisateur connecté : on synchronise son profil et on entre dans
  // l'app. Échoue silencieusement si aucune redirection n'est en cours.
  useEffect(() => {
    if (!auth) return;
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          const provider = result.providerId?.includes("apple") ? "apple.com" : "google.com";
          syncUserProfile(result.user, provider);
          router.replace("/");
        }
      })
      .catch((error: any) => {
        if (error?.code && error.code !== "auth/no-auth-event") {
          toast({ variant: "destructive", title: "Erreur de connexion", description: error.message });
        }
      });
  }, [auth]);

  const syncUserProfile = async (firebaseUser: any, provider: string) => {
    if (!db) return;
    try {
      const userRef = doc(db, "users", firebaseUser.uid);
      await setDoc(userRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Lectrice Lisoria",
        photoURL: firebaseUser.photoURL || "",
        provider: provider,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      // Profile sync error
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await syncUserProfile(userCredential.user, "password");
      toast({ title: "Bon retour !", description: "Heureux de vous revoir sur Lisoria." });
      router.replace("/");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur de connexion", description: "Identifiants incorrects ou compte inexistant." });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await syncUserProfile(result.user, "google.com");
      toast({ title: "Connexion réussie", description: "Bienvenue sur votre carnet de lecture." });
      router.replace("/");
    } catch (error: any) {
      // Sur mobile, les popups sont souvent bloquées par le navigateur :
      // on bascule alors sur la connexion par redirection, qui fonctionne
      // partout. Le retour est géré par le useEffect getRedirectResult.
      if (
        error?.code === "auth/popup-blocked" ||
        error?.code === "auth/popup-closed-by-user" ||
        error?.code === "auth/cancelled-popup-request" ||
        error?.code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError: any) {
          toast({ variant: "destructive", title: "Erreur Google", description: redirectError.message });
          return;
        }
      }
      toast({ variant: "destructive", title: "Erreur Google", description: error.message });
    }
  };

  const handleAppleLogin = async () => {
    if (!auth) return;
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    try {
      const result = await signInWithPopup(auth, provider);
      await syncUserProfile(result.user, "apple.com");
      toast({ title: "Connexion réussie", description: "Bienvenue sur votre carnet de lecture." });
      router.replace("/");
    } catch (error: any) {
      if (
        error?.code === "auth/popup-blocked" ||
        error?.code === "auth/popup-closed-by-user" ||
        error?.code === "auth/cancelled-popup-request" ||
        error?.code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError: any) {
          toast({ variant: "destructive", title: "Erreur Apple", description: redirectError.message });
          return;
        }
      }
      toast({ variant: "destructive", title: "Erreur Apple", description: error.message });
    }
  };

  const handleForgotPassword = async () => {
    if (!email || !auth) return;
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: "Email envoyé", description: "Consultez votre boîte pour réinitialiser." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <LoginScene>
      {({ season, variant }) => (
        <section className="ls-card ls-enter" aria-labelledby="login-title">
          <div className="ls-ribbon" aria-hidden="true" />
          <div className="ls-logo">
            <img src={logoSrc} alt="Lisoria" width={84} height={84} />
          </div>
          <h1 id="login-title" className="ls-title">Heureux de vous revoir</h1>
          <svg className="ls-flourish" viewBox="0 0 220 12" aria-hidden="true">
            <path pathLength={1} d="M3 7C30 1 46 11 74 6S120 2 148 7 196 9 217 4" />
          </svg>
          <p className="ls-sub">Retrouvez votre réserve littéraire.</p>

          {user ? (
            <div className="ls-form">
              <p className="ls-sub" style={{ margin: "0 0 4px" }}>
                Vous êtes déjà connecté : <b>{user.email}</b>
              </p>
              <button type="button" className="ls-btn ls-primary" onClick={() => router.replace("/")}>
                Entrer dans LISORIA <span className="ls-arrow" aria-hidden="true"><ArrowRight /></span>
              </button>
            </div>
          ) : (
            <form className="ls-form" onSubmit={handleLogin}>
              <div className="ls-field ls-stagger" style={stagger(0)}>
                <label className="ls-sr" htmlFor="login-email">Email</label>
                <Mail aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="ls-field ls-stagger" style={stagger(1)}>
                <label className="ls-sr" htmlFor="login-password">Mot de passe</label>
                <Lock aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mot de passe"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="ls-eye"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <Eye className="ls-on" aria-hidden="true" />
                  <EyeOff className="ls-off" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                className="ls-forgot ls-stagger"
                style={stagger(2)}
                onClick={handleForgotPassword}
                disabled={resetLoading}
              >
                Mot de passe oublié ?
              </button>
              <button type="submit" className="ls-btn ls-primary ls-stagger" style={stagger(3)} disabled={loading}>
                <span>{loading ? "Ouverture du livre…" : "Se connecter"}</span>
                <span className="ls-arrow" aria-hidden="true"><ArrowRight /></span>
              </button>
              <div className="ls-or ls-stagger" style={stagger(4)} aria-hidden="true">ou</div>
              <button type="button" className="ls-btn ls-soft ls-stagger" style={stagger(5)} onClick={handleGoogleLogin}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuer avec Google
              </button>
              <button type="button" className="ls-btn ls-soft ls-stagger" style={stagger(6)} onClick={handleAppleLogin}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                </svg>
                Continuer avec Apple
              </button>
            </form>
          )}

          <p className="ls-signup ls-stagger" style={stagger(7)}>
            Pas encore de compte ? <Link href="/signup">S'inscrire</Link>
          </p>
          {season !== "none" && (
            <p className="ls-seasonline ls-stagger" style={stagger(8)}>
              <span className="ls-tag" key={`tag-${variant}`}>{seasonLine(season, variant).tag}</span>
              <span key={`text-${variant}`}>{seasonLine(season, variant).text}</span>
            </p>
          )}
        </section>
      )}
    </LoginScene>
  );
}
