"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Loader2 } from "lucide-react";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import { toArray } from "@/lib/utils";

/**
 * Annuaire des lectrices ayant activé "Visible dans la communauté
 * Lectoria" (case à cocher dans Modifier le Profil). Lit la collection
 * publique `publicProfiles`, jamais `users` directement — aucune donnée
 * privée (bibliothèque, objectifs, avis) n'y transite.
 *
 * Nécessite une règle Firestore côté console pour fonctionner :
 *   match /publicProfiles/{uid} {
 *     allow read: if true;
 *     allow write: if request.auth != null && request.auth.uid == uid;
 *   }
 */
export default function CommunityPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [search, setSearch] = useState("");

  const profilesQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "publicProfiles");
  }, [db]);

  const { data: profiles = [], loading } = useCollection(profilesQuery);

  const visibleProfiles = useMemo(() => {
    return profiles
      .filter((p: any) => !p.hidden && p.id !== user?.uid)
      .filter((p: any) => (p.name || "").toLowerCase().includes(search.toLowerCase()))
      .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  }, [profiles, search, user]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="space-y-2">
        <h1 className="text-4xl font-headline italic flex items-center gap-4">
          <Users className="h-8 w-8 text-rose" /> Communauté de lectrices
        </h1>
        <p className="text-muted-foreground italic">Trouve d'autres lectrices, suis leur Palme et laisse-toi inspirer.</p>
      </header>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une lectrice par pseudo..."
          className="h-14 pl-12 rounded-2xl bg-white/60 border-none italic focus-visible:ring-1 focus-visible:ring-rose/30"
        />
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground/40" /></div>
      ) : visibleProfiles.length > 0 ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {visibleProfiles.map((p: any) => (
            <Link
              key={p.id}
              href={`/profile/${p.id}`}
              className="glass-card flex items-center gap-4 p-5 border-none bg-white/60 hover:bg-white transition-colors"
            >
              <Avatar className="h-14 w-14 border-2 border-white shadow-sm shrink-0">
                <AvatarImage src={p.avatarUrl} className="object-cover" />
                <AvatarFallback className="font-headline italic">{(p.name || "?").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <p className="font-headline italic text-lg truncate">{p.name || "Lectrice Lectoria"}</p>
                <div className="flex flex-wrap gap-1">
                  {toArray<string>(p.favoriteGenres).slice(0, 2).map((g) => (
                    <Badge key={g} variant="secondary" className="text-[9px] bg-muted">{g}</Badge>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center space-y-3 glass-card p-12">
          <p className="text-muted-foreground italic">
            {search ? "Aucune lectrice ne correspond à ta recherche." : "Aucune lectrice visible pour l'instant — sois la première à activer ta visibilité dans ton profil !"}
          </p>
        </div>
      )}
    </div>
  );
}
