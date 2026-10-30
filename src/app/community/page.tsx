"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { LoungeIcon } from "@/components/mask-icon";
import { useAmbientDark } from "@/hooks/use-ambient-dark";
import { cn } from "@/lib/utils";
import { CommunityTab } from "@/components/salon/community-tab";
import { RecoTab } from "@/components/salon/reco-tab";
import { FeedTab } from "@/components/salon/feed-tab";
import { ReleasesTab } from "@/components/salon/releases-tab";

/**
 * Lounge : l'onglet qui remplace "Actualités". Quatre vues — Communauté
 * (annuaire des lectrices), Recommandation (demandes et réponses en livres
 * du catalogue), Fil (activité partagée) et Sorties (prochaines sorties
 * détectées automatiquement). Rien à rédiger à la main.
 */
const TABS = [
  { id: "communaute", label: "Communauté" },
  { id: "recommandation", label: "Recommandation" },
  { id: "fil", label: "Fil" },
  { id: "sorties", label: "Sorties" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function LoungePage() {
  const params = useSearchParams();
  const isAmbientDark = useAmbientDark();
  const [tab, setTab] = useState<TabId>("communaute");

  useEffect(() => {
    const t = params?.get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t as TabId);
  }, [params]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-5xl mx-auto">
      <header className="space-y-2 text-center md:text-left">
        <h1 className={cn("text-4xl md:text-5xl font-headline italic flex items-center justify-center md:justify-start gap-4", isAmbientDark && "text-[#F5F1E8]")}>
          <LoungeIcon className="h-9 w-9 md:h-11 md:w-11 text-rose" /> Lounge
        </h1>
        <p className={cn("italic", isAmbientDark ? "text-[#F5F1E8]/70" : "text-muted-foreground")}>Entre lectrices : trouve, demande, inspire-toi.</p>
      </header>

      <div role="tablist" aria-label="Sections du Lounge" className="flex gap-1 flex-wrap rounded-full bg-primary/[0.06] p-1 w-fit max-w-full">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("rounded-full px-4 py-2 text-sm font-medium transition-colors", tab === t.id ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary")}>
            {t.label}
          </button>
        ))}
      </div>

      <section role="tabpanel">
        {tab === "communaute" && <CommunityTab />}
        {tab === "recommandation" && <RecoTab />}
        {tab === "fil" && <FeedTab />}
        {tab === "sorties" && <ReleasesTab />}
      </section>
    </div>
  );
}
