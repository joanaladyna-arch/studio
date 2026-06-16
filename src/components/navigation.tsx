
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, PenTool, User, Heart, Feather, LogOut, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/library", label: "Bibliothèque", icon: Library },
  { href: "/add", label: "Ajouter", icon: PlusCircle },
  { href: "/coeur-de-plume", label: "De Plume", icon: Heart },
  { href: "/journal", label: "Journal", icon: PenTool },
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
      console.error("PLUME Auth Error:", error);
    }
  };

  if (pathname === "/login" || pathname === "/signup") return null;

  return (
    <>
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-xl border-b border-white/40 h-24 items-center justify-center gap-8 px-10 shadow-sm">
        <div className="flex items-center gap-3 mr-10 cursor-pointer group" onClick={() => router.push("/")}>
          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
             <Feather className="h-6 w-6 text-primary" />
          </div>
          <span className="font-headline text-3xl tracking-widest italic text-primary/80 uppercase">PLUME</span>
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
                  "group flex items-center gap-3 transition-all duration-500 py-3 px-6 rounded-2xl",
                  isActive 
                    ? "text-primary bg-primary/5 font-medium shadow-[inset_0_0_20px_rgba(0,0,0,0.02)]" 
                    : "text-muted-foreground hover:text-primary hover:bg-white"
                )}
              >
                <Icon className={cn("h-5 w-5 transition-all duration-500", isActive && "scale-110 text-primary fill-primary/10")} />
                <span className="text-sm font-headline italic">{item.label}</span>
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

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-3xl border-t border-white/40 px-2 py-3 flex justify-around items-center md:hidden h-24 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        {navItems.map((item) => {
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
                "p-2 rounded-xl transition-all duration-500",
                isActive ? "bg-primary/10 scale-125 shadow-sm" : "bg-transparent"
              )}>
                <Icon className={cn("h-5 w-5", isActive && "fill-primary/20")} />
              </div>
              <span className={cn(
                "text-[10px] font-headline italic tracking-tight font-bold transition-all",
                isActive ? "opacity-100" : "opacity-40"
              )}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
