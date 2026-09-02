"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Trophy, Shield, Medal, ArrowRight } from "lucide-react";
import { GENRES_LIST, TROPES_LIST } from "@/app/library/page";
import { toArray, cn } from "@/lib/utils";

const LEVELS = [
  { label: "Bronze", min: 5, gradient: "linear-gradient(160deg, #F3CFA0, #9C6A34)" },
  { label: "Argent", min: 15, gradient: "linear-gradient(160deg, #FFFFFF, #9AA0A6)" },
  { label: "Or", min: 50, gradient: "linear-gradient(160deg, #FDF0DA, #D4AF37)" },
  { label: "Diamant", min: 100, gradient: "linear-gradient(160deg, #E8FBFF, #59C2E0)" },
];

function getLevel(count: number) {
  if (count >= 100) return LEVELS[3];
  if (count >= 50) return LEVELS[2];
  if (count >= 15) return LEVELS[1];
  if (count >= 5) return LEVELS[0];
  return null;
}

type Badge = { name: string; count: number; level: (typeof LEVELS)[number]; kind: "genre" | "trope" };

export function BadgeVitrine({ allBooks }: { allBooks: any[] }) {
  const badges = useMemo(() => {
    const readBooks = allBooks.filter((b: any) => b.status === "read" || b.status === "reread");

    const tally = (list: string[], kind: "genre" | "trope") => {
      const stats: Record<string, number> = {};
      list.forEach((g) => (stats[g] = 0));
      readBooks.forEach((b: any) => {
        toArray<string>(kind === "genre" ? b.genres : b.tropes).forEach((g) => {
          if (stats[g] !== undefined) stats[g]++;
        });
      });
      return Object.entries(stats)
        .map(([name, count]) => ({ name, count, level: getLevel(count), kind }))
        .filter((b): b is Badge => b.level !== null);
    };

    const unlocked = [...tally(GENRES_LIST, "genre"), ...tally(TROPES_LIST, "trope")];
    unlocked.sort((a, b) => b.count - a.count);

    return {
      unlocked,
      total: GENRES_LIST.length + TROPES_LIST.length,
    };
  }, [allBooks]);

  const topBadges = badges.unlocked.slice(0, 4);

  return (
    <div
      className="relative overflow-hidden rounded-[2rem] p-6"
      style={{
        background: "linear-gradient(135deg, #EFE6D4, #E4D4B8)",
        boxShadow: "0 16px 40px -20px rgba(120,90,50,0.22), inset 0 0 0 1px rgba(212,175,120,0.3)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "linear-gradient(0deg, rgba(255,251,244,0.88) 15%, rgba(255,251,244,0.25) 70%, rgba(255,251,244,0.05) 100%)" }}
      />
      <div className="relative space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: "linear-gradient(160deg, #FDF0DA, #F5DDB0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 6px rgba(180,140,80,0.25)" }}
            >
              <Trophy className="h-5 w-5 text-copper" />
            </div>
            <div>
              <span className="block font-headline italic text-[13px] text-copper">Ma vitrine de</span>
              <span className="block font-headline font-semibold text-2xl">BADGES</span>
            </div>
          </div>
          <span className="shrink-0 flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(212,175,120,0.4)" }}>
            ⭐ {badges.unlocked.length}/{badges.total}
          </span>
        </div>
        <p className="text-xs text-muted-foreground ml-[3.5rem]">Chaque histoire lue, un nouveau badge gagné.</p>

        <div className="flex items-center gap-2 my-4 text-copper text-[10px]">
          <span className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,120,0.5), transparent)" }} />
          ✦
          <span className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,120,0.5), transparent)" }} />
        </div>

        {topBadges.length > 0 ? (
          <div className="flex flex-col">
            {topBadges.map((b) => (
              <div key={`${b.kind}-${b.name}`} className="flex items-center gap-3 py-2.5 border-b last:border-b-0" style={{ borderColor: "rgba(212,175,120,0.18)" }}>
                <div
                  className="h-[52px] w-[52px] shrink-0 flex items-center justify-center"
                  style={{
                    background: b.level.gradient,
                    clipPath: "polygon(50% 0%, 100% 20%, 100% 58%, 50% 100%, 0% 58%, 0% 20%)",
                    filter: "drop-shadow(0 4px 6px rgba(120,90,50,0.3))",
                  }}
                >
                  {b.kind === "genre" ? <Shield className="h-5 w-5 text-white" strokeWidth={2} /> : <Medal className="h-5 w-5 text-white" strokeWidth={2} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight truncate">{b.name}</p>
                  <span
                    className={cn(
                      "inline-block text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mt-1",
                      b.level.label === "Argent" && "text-neutral-500 bg-neutral-100",
                      b.level.label === "Bronze" && "text-[#A9682E] bg-[#FBEBD9]",
                      b.level.label === "Or" && "text-[#9C7A1F] bg-[#FBF3D9]",
                      b.level.label === "Diamant" && "text-[#2C8FB0] bg-[#E4F7FC]"
                    )}
                  >
                    {b.level.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground py-4 text-center">
            Continue à lire pour débloquer tes premiers badges.
          </p>
        )}

        <Link
          href="/profile/badges"
          className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-copper rounded-full py-2.5"
          style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(212,175,120,0.4)" }}
        >
          Voir tous mes exploits <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
