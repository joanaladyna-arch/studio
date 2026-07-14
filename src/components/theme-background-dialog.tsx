"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Palette, Check, Loader2 } from "lucide-react";
import { useUser, useFirestore } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { THEME_BACKGROUNDS, ThemeBackgroundId } from "@/lib/theme-backgrounds";
import { cn } from "@/lib/utils";

export function ThemeBackgroundDialog({ currentTheme }: { currentTheme?: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const selectTheme = async (id: ThemeBackgroundId) => {
    if (!db || !user) return;
    setSaving(id);
    try {
      await setDoc(doc(db, "users", user.uid), { themeBackground: id }, { merge: true });
      toast({ title: "Ambiance appliquée" });
      setOpen(false);
    } catch (err) {
      console.error("Theme Background Save Error:", err);
      toast({ variant: "destructive", title: "Erreur d'enregistrement" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="rounded-full h-11 px-5 text-sm md:h-14 md:px-8 text-primary hover:bg-primary/5 font-headline italic md:text-lg transition-colors"
      >
        <Palette className="h-5 w-5 mr-3" /> Personnaliser mon espace
      </Button>
      <DialogContent className="glass-card border-none max-w-2xl bg-white/95 backdrop-blur-3xl p-8">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl italic flex items-center gap-3">
            <Palette className="h-6 w-6 text-rose" /> Personnaliser mon espace
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs italic opacity-60 -mt-2">
          Choisis l'ambiance derrière tes pages — tes cartes et ta bibliothèque restent identiques.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2">
          {THEME_BACKGROUNDS.map((t) => {
            const isSelected = (currentTheme || "default") === t.id;
            const isLight = !t.gradient || t.id === "creme" || t.id.endsWith("-clair");
            return (
              <button
                key={t.id}
                onClick={() => selectTheme(t.id)}
                disabled={saving !== null}
                className="relative rounded-2xl overflow-hidden aspect-square flex items-end p-2.5 shadow-sm border border-black/5 transition-transform hover:scale-[1.03] disabled:opacity-60"
                style={{ background: t.gradient || "var(--background, #F5F1E8)" }}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-rose flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                {saving === t.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                <span
                  className={cn(
                    "text-[10px] font-headline italic font-semibold leading-tight",
                    isLight ? "text-anthracite" : "text-white"
                  )}
                  style={{ color: isLight ? "#2B2E33" : "#FFFCF8" }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
