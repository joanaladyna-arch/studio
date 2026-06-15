
"use client";

import { useState } from "react";
import { useAuth, useFirestore } from "@/firebase";
import { createUserWithEmailAndPassword, updateProfile, fetchSignInMethodsForEmail } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Feather, Mail, Lock, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;
    setLoading(true);
    try {
      // Vérification proactive de l'email
      const existingMethods = await fetchSignInMethodsForEmail(auth, email);
      if (existingMethods.length > 0) {
        toast({
          variant: "destructive",
          title: "Compte déjà existant",
          description: `Vous avez déjà un compte via : ${existingMethods.join(', ')}. Veuillez vous connecter.`,
        });
        router.push("/login");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update Firebase Auth profile
      await updateProfile(user, { displayName: name });

      // Create User Profile in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        annualGoal: 24,
        provider: "password",
        photoURL: `https://picsum.photos/seed/${user.uid}/200`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Bienvenue sur Plume !",
        description: `Votre sanctuaire littéraire est prêt, ${name}.`,
      });
      router.push("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: error.message || "Une erreur est survenue lors de la création du compte.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 animate-in fade-in duration-1000">
      <Card className="glass-card w-full max-w-md border-none shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Feather className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl font-headline italic">Commencer l'aventure</CardTitle>
          <CardDescription className="italic">Créez votre journal de lecture personnel.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Votre nom ou pseudo" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 bg-white/50 border-none h-12"
                  required
                />
              </div>
            </div>
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
                  placeholder="Mot de passe (min. 6 caractères)" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-white/50 border-none h-12"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90" disabled={loading}>
              {loading ? "Création du carnet..." : "Créer mon compte"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground italic">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Se connecter
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
