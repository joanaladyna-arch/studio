"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, UserPlus, UserCheck, Users, Sparkles } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { cleanBookTitle, cleanAuthorName } from "@/lib/utils";
import { useFirestore, useDoc, useUser } from "@/firebase";
import { doc, setDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";
import { toArray } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/**
 * Vue publique du profil d'une autre lectrice — lit uniquement
 * publicProfiles/{uid} (jamais users/{uid} d'une autre personne).
 * "Suivre" écrit uniquement sur son PROPRE document (followedUsers),
 * exactement comme le suivi d'auteur existant : aucune écriture sur le
 * profil visité.
 */
export default function PublicProfilePage() {
  const params = useParams();
  const uid = params?.uid as string;
  const router = useRouter();
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (user && uid && user.uid === uid) router.replace("/profile");
  }, [user, uid, router]);

  const publicProfileRef = useMemo(() => {
    if (!db || !uid) return null;
    return doc(db, "publicProfiles", uid);
  }, [db, uid]);
  const { data: publicProfile, loading } = useDoc(publicProfileRef);

  const myProfileRef = useMemo(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: myProfile } = useDoc(myProfileRef);

  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const isFollowing = toArray<string>((myProfile as any)?.followedUsers).includes(uid);

  const toggleFollow = async () => {
    if (!db || !user || !uid) return;
    setIsFollowLoading(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { followedUsers: isFollowing ? arrayRemove(uid) : arrayUnion(uid) },
        { merge: true }
      );
      // Miroir dans followers/{uid}/entries/{monUid} — permet à la
      // lectrice suivie de connaître son nombre d'abonnées sans avoir à
      // lire le document privé de chaque autre utilisatrice (impossible
      // avec les règles actuelles). Chacune n'écrit jamais que sa PROPRE
      // entrée, jamais le compteur d'une autre.
      const followerEntryRef = doc(db, "followers", uid, "entries", user.uid);
      if (isFollowing) {
        await deleteDoc(followerEntryRef);
      } else {
        await setDoc(followerEntryRef, { followedAt: serverTimestamp() });
      }
      toast({
        title: isFollowing ? "Lectrice retirée du suivi" : "Lectrice suivie",
        description: isFollowing ? undefined : "Elle apparaîtra dans tes recommandations.",
      });
    } catch (err) {
      console.error("Toggle Follow User Error:", err);
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setIsFollowLoading(false);
    }
  };

  if (loading) {
    return <div className="py-32 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground/40" /></div>;
  }

  if (!publicProfile || (publicProfile as any).hidden) {
    return (
      <div className="py-32 text-center space-y-4">
        <p className="text-muted-foreground italic">Ce profil n'est pas (ou plus) visible dans la communauté.</p>
        <Button asChild variant="link" className="text-rose"><Link href="/community">Retour à la communauté</Link></Button>
      </div>
    );
  }

  const p = publicProfile as any;

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <Link href="/community" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Communauté
      </Link>

      <header className="flex flex-col items-center text-center gap-6 pt-4">
        <Avatar className="h-32 w-32 border-4 border-white shadow-2xl">
          <AvatarImage src={p.avatarUrl} className="object-cover" />
          <AvatarFallback className="font-headline italic text-3xl">{(p.name || "?").charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <h1 className="text-4xl font-headline italic">{p.name || "Lectrice Lectoria"}</h1>
          {p.bio && <p className="text-muted-foreground italic max-w-md">{p.bio}</p>}
        </div>
        {user && (
          <Button
            onClick={toggleFollow}
            disabled={isFollowLoading}
            className={
              isFollowing
                ? "rounded-full h-12 px-8 bg-primary text-white font-headline italic"
                : "rounded-full h-12 px-8 border border-rose/30 text-rose bg-rose/5 hover:bg-rose/10 font-headline italic"
            }
            variant={isFollowing ? "default" : "outline"}
          >
            {isFollowLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isFollowing ? (
              <UserCheck className="h-4 w-4 mr-2" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            {isFollowing ? "Suivie" : "Suivre"}
          </Button>
        )}
      </header>

      {toArray<string>(p.favoriteGenres).length > 0 && (
        <div className="space-y-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center justify-center gap-2">
            <Users className="h-3.5 w-3.5" /> Genres favoris
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {toArray<string>(p.favoriteGenres).map((g) => (
              <Badge key={g} variant="secondary" className="bg-muted italic">{g}</Badge>
            ))}
          </div>
        </div>
      )}

      {toArray<any>(p.recommendedBooks).length > 0 && (
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-copper/70 flex items-center justify-center gap-2">
            <Sparkles className="h-3.5 w-3.5" /> Pépites Incontournables de {p.name || "cette lectrice"}
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 px-1 no-scrollbar">
            {toArray<any>(p.recommendedBooks).map((b) => (
              <div key={b.id} className="w-20 shrink-0 space-y-1.5 text-center">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-sm bg-secondary/10">
                  <BookCover src={b.cover} alt={b.title || ""} className="object-cover" />
                </div>
                <p className="text-[9px] italic leading-tight truncate">{cleanBookTitle(b.title)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
