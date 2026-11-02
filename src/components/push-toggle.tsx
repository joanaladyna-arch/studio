"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push-client";

/** Interrupteur "Alertes sur cet appareil" (notifications push), rangé en bas de la cloche. */
export function PushToggle() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPushState().then(setState); }, []);
  if (!state || state === "unsupported" || !user) return null;

  const hints: Partial<Record<PushState, string>> = {
    "no-key": "Bientôt disponible : la clé d'alerte n'est pas encore configurée.",
    denied: "Bloquées dans ton navigateur : autorise-les dans les réglages du site.",
  };

  const toggle = async (on: boolean) => {
    if (!db) return;
    setBusy(true);
    try {
      const next = on ? await enablePush(db, user.uid) : await disablePush(db, user.uid);
      setState(next);
      if (on && next === "on") toast({ title: "Alertes activées", description: "Tu seras prévenue sur cet appareil, même quand Lisoria est fermée." });
      if (on && next === "denied") toast({ variant: "destructive", title: "Alertes refusées", description: "Tu peux les autoriser dans les réglages de ton navigateur." });
    } catch (err) {
      console.error("Push toggle:", err);
      toast({ variant: "destructive", title: "Activation impossible", description: "Réessaie dans un instant." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-primary/5 px-5 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold flex items-center gap-1.5"><BellRing className="h-3.5 w-3.5" /> Alertes sur cet appareil</p>
        <p className="text-[10px] text-muted-foreground leading-snug">{hints[state] || "Même quand Lisoria est fermée."}</p>
      </div>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Switch checked={state === "on"} disabled={state === "no-key" || state === "denied"} onCheckedChange={toggle} aria-label="Alertes sur cet appareil" />}
    </div>
  );
}
