"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, PenTool, User, BarChart3, Heart, Feather, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/library", label: "Bibliothèque", icon: Library },
  { href: "/coeur-de-plume", label: "Cœur de Plume", icon: Heart },
  { href: "/journal", label: "Journal", icon: PenTool },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/profile", label: "Profil", icon: User },
];

export function Navigation() {
  const pathname = usePathname();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      toast({
        title: "Déconnexion",
        description: "À bientôt sur Plume !",
      });
      router.push("/login");
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  // Ne pas afficher la navigation sur les pages d'auth
  if (pathname === "/login" || pathname === "/signup") return null;

  return (
    <>
      {/* Desktop Navigation (Top) */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-xl border-b border-white/40 h-20 items-center justify-center gap-8 px-8">
        <div className="flex items-center gap-2 mr-12 cursor-pointer" onClick={() => router.push("/")}>
          <Feather className="h-6 w-6 text-primary" />
          <span className="font-headline text-2xl tracking-widest italic text-primary/80 uppercase">PLUME</span>
        </div>
        <div className="flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2 transition-all duration-300 py-2 px-4 rounded-full",
                  isActive 
                    ? "text-primary bg-primary/10 font-medium" 
                    : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                )}
              >
                <Icon className={cn("h-4 w-4 transition-transform duration-500", isActive && "scale-110")} />
                <span className="text-sm font-headline italic">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <button 
          onClick={handleLogout}
          className="ml-8 text-muted-foreground hover:text-destructive transition-colors p-2 rounded-full hover:bg-red-50"
          title="Déconnexion"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </nav>

      {/* Mobile Navigation (Fixed Bottom) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-2xl border-t border-white/40 px-2 py-2 flex justify-around items-center md:hidden h-20 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-all duration-500 p-2 rounded-2xl min-w-[50px]",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all duration-300",
                isActive ? "bg-primary/10 scale-110" : "bg-transparent"
              )}>
                <Icon className={cn("h-5 w-5")} />
              </div>
              <span className={cn(
                "text-[9px] font-headline italic tracking-tight font-bold transition-all",
                isActive ? "opacity-100" : "opacity-60"
              )}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
