"use client";

import { useState } from "react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * Répare en masse les couvertures manquantes dans les bibliothèques
 * personnelles, en les resynchronisant depuis la fiche masterBooks liée
 * quand celle-ci en a une (voir /api/admin/audit-covers pour le pourquoi
 * du désync). Ne touche jamais les livres ajoutés manuellement (sans
 * fiche masterBooks associée) : ceux-là restent à illustrer par la
 * lectrice elle-même, cas typique de l'auto-édition.
 */
export function CoverAuditManager() {
  const { user } = useUser();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ scanned: number; missingCover: number; repaired: number; stillMissing: number; masterCoversEnriched: number; masterCoversRemaining: number; quotaExceeded?: boolean } | null>(null);

  const runAudit = async () => {
    if (!user) return;
    setIsRunning(true);
    setResult(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/audit-covers", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      if (data.quotaExceeded) {
        toast({
          variant: "destructive",
          title: "Quota Google Books dépassé",
          description: "Réessaie plus tard (quota gratuit quotidien épuisé) — ce n'est pas propre à Lectoria.",
        });
      } else {
        toast({ title: "Audit terminé", description: `${data.repaired} couverture(s) réparée(s) sur ${data.missingCover} manquante(s).` });
      }
    } catch (err) {
      console.error("Cover Audit Error:", err);
      toast({ variant: "destructive", title: "Erreur d'audit", description: (err as any)?.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-headline italic flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-primary" /> Réparer les couvertures manquantes
      </h3>
      <p className="text-xs italic opacity-60">
        Cherche d'abord une couverture sur Google Books pour les fiches catalogue qui n'en ont encore aucune, puis
        recopie la couverture de chaque fiche dans les livres personnels qui n'en ont pas. Les livres ajoutés
        manuellement (auto-édition sans fiche partagée) ne sont jamais touchés.
      </p>
      <Button
        onClick={runAudit}
        disabled={isRunning}
        className="h-11 rounded-xl italic font-headline bg-primary"
      >
        {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Lancer l'audit
      </Button>
      {result && (
        <div className="space-y-1">
          <p className="text-xs opacity-60 italic">
            {result.masterCoversEnriched} fiche(s) catalogue enrichie(s) depuis Google Books. {result.scanned}{" "}
            livre(s) analysé(s) au total, {result.missingCover} sans couverture, {result.repaired} réparé(s),{" "}
            {result.stillMissing} toujours sans couverture disponible (introuvable sur Google Books, ou ajout
            manuel).
          </p>
          {result.masterCoversRemaining > 0 && (
            <p className="text-xs text-copper italic">
              {result.masterCoversRemaining} fiche(s) catalogue restent à traiter (plafond par passage) — relance
              l'audit pour continuer.
            </p>
          )}
          {result.quotaExceeded && (
            <p className="text-xs text-destructive italic">
              Quota gratuit Google Books dépassé pour aujourd'hui — les recherches de couverture (ici et dans
              Ajouter) ne fonctionneront plus jusqu'à demain. Relance l'audit alors pour continuer.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
