
"use client";

import { useAdminMode } from "@/components/admin-mode";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Petite barre flottante, visible UNIQUEMENT pour l'administratrice, qui
 * permet de basculer entre la "vue lectrice" (ce que voient les
 * utilisatrices) et le "mode administrateur" (contrôles d'édition
 * intégrés directement dans chaque page). Positionnée au-dessus de la
 * barre de navigation mobile, en tenant compte de la hauteur réelle de
 * cette barre + la barre système Android/iOS (safe-area-inset-bottom).
 */
export function AdminModeBar() {
  const { isAdmin, adminMode, setAdminMode } = useAdminMode();

  if (!isAdmin) return null;

  return (
    <div
      className={cn(
        // Desktop : en bas à droite, loin de la nav
        // Mobile : juste au-dessus de la barre de navigation
        // On utilise un style inline pour calculer la position dynamiquement
        // en tenant compte de la safe-area iOS/Android
        "fixed z-[55] right-4 md:bottom-6 md:right-6",
        "flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-xl border transition-colors",
        adminMode
          ? "bg-primary text-white border-primary"
          : "bg-white/80 text-primary border-white/60"
      )}
      style={{
        // Mobile : positionné à 72px au-dessus du bas + safe-area
        // (hauteur barre nav ~60px + marge 12px)
        bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {adminMode ? <ShieldCheck className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      <span className="text-xs font-headline italic whitespace-nowrap">
        {adminMode ? "Mode admin" : "Vue lectrice"}
      </span>
      <Switch
        checked={adminMode}
        onCheckedChange={setAdminMode}
        className={adminMode ? "data-[state=checked]:bg-white/30" : ""}
      />
    </div>
  );
}
