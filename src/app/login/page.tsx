
"use client";

import { useState, useEffect } from "react";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Feather, Mail, Lock, Chrome, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (user) {
      console.log("Plume Login: Utilisateur déjà détecté, redirection...");
      router.replace("/");
    }
  }, [user, router]);

  const syncUserProfile = async (user: any, provider: string) => {
    if (!db) return;
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email?.split('@')[0] || "Utilisateur Plume",
        photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/200`,
        provider: provider,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error("Plume : Erreur lors de la synchronisation Firestore :", e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await syncUserProfile(userCredential.user, "password");
      toast({ title: "Bon retour !", description: "Heureux de vous revoir sur Plume." });
      router.replace("/");
    } catch (error: any) {
      console.error("Plume Login Error:", error.code, error.message);
      let message = "Email ou mot de passe incorrect.";
      if (error.code === 'auth/invalid-credential') message = "Identifiants invalides.";
      toast({ variant: "destructive", title: "Erreur de connexion", description: message });
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
      console.error("Plume Google Error:", error.code, error.message);
      toast({ variant: "destructive", title: "Erreur Google", description: error.message });
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
    <div className="min-h-[80vh] flex items-center justify-center p-4 animate-in fade-in duration-1000">
      <Card className="glass-card w-full max-w-md border-none shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Feather className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl font-headline italic">Heureux de vous revoir</CardTitle>
          <CardDescription className="italic">Retrouvez votre sanctuaire littéraire.</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-6 text-center py-8">
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <p className="text-sm italic text-primary">Connexion active détectée.</p>
              </div>
              <Button onClick={() => router.replace("/")} className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90">
                Entrer dans PLUME <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="email" 
                      placeholder="Email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white/50 border-none h-12"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="password" 
                      placeholder="Mot de passe" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 bg-white/50 border-none h-12"
                      required
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-primary hover:underline italic float-right"
                    disabled={resetLoading}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <Button type="submit" className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90" disabled={loading}>
                  {loading ? "Connexion..." : "Se connecter"}
                </Button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-primary/10"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground italic">Ou continuer avec</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full h-12 rounded-2xl border-primary/10 hover:bg-primary/5"
                onClick={handleGoogleLogin}
              >
                <Chrome className="mr-2 h-4 w-4" /> Google
              </Button>
            </>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground italic">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="text-primary font-bold hover:underline">
              S'inscrire
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
