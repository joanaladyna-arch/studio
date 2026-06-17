
"use client";

import { useAdminMode } from "@/components/admin-mode";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Petite barre flottante, visible UNIQUEMENT pour l'administratrice, qui
 * permet de basculer entre la "vue lectrice" (ce que voient les
 * utilisatrices) et le "mode administrateur" (contrôles d'édition
 * intégrés directement dans chaque page). Discrète, en bas à droite,
 * au-dessus de la barre de navigation mobile.
 */
export function AdminModeBar() {
  const { isAdmin, adminMode, setAdminMode } = useAdminMode();

  if (!isAdmin) return null;

  return (
    <div
      className={cn(
        "fixed z-[55] bottom-28 right-4 md:bottom-6 md:right-6",
        "flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-xl border transition-colors",
        adminMode
          ? "bg-primary text-white border-primary"
          : "bg-white/80 text-primary border-white/60"
      )}
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
