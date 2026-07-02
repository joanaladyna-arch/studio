
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, PenTool, User, Heart, LogOut, PlusCircle, ShieldCheck, Newspaper } from "lucide-react";
import { cn, ADMIN_EMAILS } from "@/lib/utils";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

// "id" est la clé stable utilisée pour stocker les personnalisations
// (nom, visibilité) dans Firestore — séparée du href, qui lui ne change
// jamais puisqu'il pointe vers une page réelle du code.
export const navItems = [
  { id: "home", href: "/", label: "Accueil", icon: Home },
  { id: "library", href: "/library", label: "Bibliothèque", icon: Library },
  { id: "add", href: "/add", label: "Ajouter", icon: PlusCircle },
  { id: "coeur-de-plume", href: "/coups-de-coeur", label: "Coups de Cœur", icon: Heart },
  { id: "actualites", href: "/actualites", label: "Actualités", icon: Newspaper },
  { id: "journal", href: "/journal", label: "Journal", icon: PenTool },
  { id: "profile", href: "/profile", label: "Profil", icon: User },
];

type NavOverride = { label?: string; visible?: boolean };

export function Navigation() {
  const pathname = usePathname();
  const auth = useAuth();
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<Record<string, NavOverride>>({});
  const [hasUnseenActuality, setHasUnseenActuality] = useState(false);

  // Lu une seule fois au montage (la Navigation reste montée tout au long
  // de la navigation côté client grâce au layout racine) : pas besoin de
  // re-lire à chaque changement de page.
  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, "config", "navigation"))
      .then((snap) => {
        if (snap.exists()) setOverrides(snap.data()?.items || {});
      })
      .catch(() => {
        // Échec silencieux : on garde simplement les noms/visibilités
        // par défaut, jamais bloquant pour la navigation elle-même.
      });
  }, [db]);

  // Point d'alerte sur "Actualités" : compare les actualités des auteurs
  // suivis à la dernière visite de la page (lastSeenActualityAt). Échoue
  // toujours silencieusement — un indicateur en moins n'est jamais
  // bloquant pour la navigation elle-même.
  useEffect(() => {
    if (!db || !user) return;
    (async () => {
      try {
        const profileSnap = await getDoc(doc(db, "users", user.uid));
        const followedAuthors: string[] = profileSnap.data()?.followedAuthors || [];
        if (followedAuthors.length === 0) return;
        const lastSeenMillis = profileSnap.data()?.lastSeenActualityAt?.toMillis?.() || 0;
        const actSnap = await getDocs(collection(db, "actualites"));
        const hasNew = actSnap.docs.some((d) => {
          const data: any = d.data();
          if (!data.authorSlug || !followedAuthors.includes(data.authorSlug)) return false;
          return (data.publishedAt?.toMillis?.() || 0) > lastSeenMillis;
        });
        setHasUnseenActuality(hasNew);
      } catch {
        // silencieux
      }
    })();
  }, [db, user]);

  // "Admin" n'apparaît que pour le(s) email(s) autorisé(s) — la page
  // /admin existe mais ne doit être visible que pour Joana. Elle n'est
  // volontairement pas personnalisable ici, pour éviter de se couper
  // accidentellement l'accès à l'écran qui permet justement de gérer
  // cette personnalisation.
  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));
  const visibleNavItems = navItems
    .map((item) => ({
      ...item,
      label: overrides[item.id]?.label?.trim() || item.label,
      visible: overrides[item.id]?.visible !== false,
    }))
    .filter((item) => item.visible);
  const allNavItems = [
    ...visibleNavItems,
    ...(isAdmin ? [{ id: "admin", href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      toast({
        title: "Déconnexion",
        description: "À bientôt sur Lectoria !",
      });
      router.push("/login");
    } catch (error) {
      console.error("LECTORIA Auth Error:", error);
    }
  };

  if (pathname === "/login" || pathname === "/signup") return null;

  return (
    <>
      <nav className="hidden lg:flex fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-xl border-b border-white/40 h-24 items-center justify-center gap-8 px-10 shadow-sm">
        <div className="flex items-center gap-3 mr-10 cursor-pointer group" onClick={() => router.push("/")}>
          <div className="relative h-10 w-10 rounded-full overflow-hidden group-hover:scale-110 transition-transform">
             <Image src="/brand/logo-lectoria-v2.png" alt="" fill className="object-cover" unoptimized />
          </div>
          <span className="font-headline text-3xl tracking-widest italic text-primary/80 uppercase">LECTORIA</span>
        </div>
        <div className="flex items-center gap-2">
          {allNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 transition-all duration-500 py-3 px-6 rounded-2xl",
                  isActive 
                    ? "text-primary bg-primary/5 font-medium shadow-[inset_0_0_20px_rgba(0,0,0,0.02)]" 
                    : "text-muted-foreground hover:text-primary hover:bg-white"
                )}
              >
                <Icon className={cn("h-5 w-5 transition-all duration-500", isActive && "scale-110 text-primary fill-primary/10")} />
                <span className="text-sm font-headline italic">{item.label}</span>
                {item.id === "actualites" && hasUnseenActuality && (
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                )}
              </Link>
            );
          })}
        </div>
        <button 
          onClick={handleLogout}
          className="ml-8 text-muted-foreground hover:text-destructive transition-all p-3 rounded-full hover:bg-red-50 group"
          title="Déconnexion"
        >
          <LogOut className="h-6 w-6 group-hover:rotate-12 transition-transform" />
        </button>
      </nav>

      {/* Barre de navigation mobile — fixée en bas avec support de la
          barre système Android (boutons retour/accueil/multitâche) et de
          l'encoche/home indicator iOS via env(safe-area-inset-bottom).
          Sans ce padding, les icônes sont cachées sous la barre système
          sur les appareils Android avec navigation par boutons. */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-3xl border-t border-white/40 px-2 pt-3 flex justify-around items-center lg:hidden shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        {allNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 transition-all duration-700 p-2 rounded-2xl min-w-[60px]",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "relative p-2 rounded-xl transition-all duration-500",
                isActive ? "bg-primary/10 scale-125 shadow-sm" : "bg-transparent"
              )}>
                <Icon className={cn("h-5 w-5", isActive && "fill-primary/20")} />
                {item.id === "actualites" && hasUnseenActuality && (
                  <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-rose-500" />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-headline italic tracking-tight font-bold transition-all",
                isActive ? "opacity-100" : "opacity-40"
              )}>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-1.5 transition-all duration-700 p-2 rounded-2xl min-w-[60px] text-muted-foreground"
        >
          <div className="relative p-2 rounded-xl bg-transparent">
            <LogOut className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-headline italic tracking-tight font-bold opacity-40">Quitter</span>
        </button>
      </nav>
    </>
  );
}
