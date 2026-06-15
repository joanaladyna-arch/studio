"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, PlusCircle, PenTool, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/library", label: "Bibliothèque", icon: Library },
  { href: "/add", label: "Ajouter", icon: PlusCircle },
  { href: "/journal", label: "Journal", icon: PenTool },
  { href: "/profile", label: "Profil", icon: User },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border px-4 py-2 flex justify-around items-center md:top-0 md:bottom-auto md:border-t-0 md:border-b md:h-16 h-16">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-all duration-300 px-3 py-1 rounded-lg",
              isActive 
                ? "text-primary bg-primary/10" 
                : "text-muted-foreground hover:text-primary hover:bg-primary/5"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] md:text-xs font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}