"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { getCurrentSeasonalTheme } from "@/lib/seasonal-theme";

/**
 * Écran d'ouverture, affiché une seule fois par session (cf. layout.tsx,
 * via sessionStorage) avant d'accéder à l'app — connecté(e) ou non.
 * Le bouton "Commencer" ne navigue pas en dur vers /login : il appelle
 * onFinish, qui referme cet écran et laisse le flux normal (AuthGuard)
 * décider de la suite — bibliothèque si déjà connecté, connexion sinon.
 *
 * Habillage saisonnier (voir seasonal-theme.ts) : dégradé + tracé recolorés
 * + illustration de coin à faible opacité quand une saison est active,
 * design d'origine (fond marine) sinon — deux périodes de l'année n'ont
 * volontairement pas de thème assigné, voir le commentaire dans
 * seasonal-theme.ts.
 */
export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const theme = useMemo(() => getCurrentSeasonalTheme(), []);

  const background = theme
    ? `linear-gradient(180deg, ${theme.top} 0%, ${theme.bottom} 100%)`
    : "linear-gradient(180deg, #1B2430 0%, #2A3644 100%)";
  const textColor = theme ? theme.ink : "#FFFFFF";
  const strokeColor = theme ? theme.accent : "#D98BA0";
  const rectLineColor = theme ? theme.ink : "#FFFFFF";
  const buttonBg = theme ? theme.ink : "#F5F1E8";
  const buttonText = theme ? theme.top : "#1B2430";
  const waveColor = theme ? theme.accent : "#B08457";

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden flex flex-col items-center justify-center px-8 text-center"
      style={{ background, color: textColor }}
    >
      {theme && (
        <img
          src={theme.illustration}
          alt=""
          className="absolute z-0 pointer-events-none"
          style={{ bottom: "-1vh", right: "-2vw", width: "58vw", maxWidth: 320, height: "auto", opacity: 0.2 }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center max-w-sm animate-in fade-in duration-700">
        <svg width="120" height="140" viewBox="0 0 120 140" fill="none" className="mb-10 drop-shadow-sm">
          <path
            d="M60 20 C45 35 38 55 40 78 C42 60 50 48 60 30 C58 50 52 64 44 78 C56 76 66 66 70 50 C72 40 70 28 60 20 Z"
            stroke={strokeColor} strokeWidth="3" strokeLinejoin="round" fill="none"
          />
          <rect x="14" y="92" width="92" height="22" rx="11" stroke={rectLineColor} strokeWidth="3" fill="none" />
          <path d="M22 103 H98" stroke={rectLineColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        </svg>

        <h1 className="font-headline text-5xl italic" style={{ color: textColor }}>Bienvenue</h1>

        <div className="flex items-center gap-3 my-5 w-40">
          <div className="h-px flex-1" style={{ backgroundColor: textColor, opacity: 0.4 }} />
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: strokeColor, opacity: 0.7 }} />
          <div className="h-px flex-1" style={{ backgroundColor: textColor, opacity: 0.4 }} />
        </div>

        <p className="font-headline italic text-lg leading-relaxed" style={{ color: textColor, opacity: 0.85 }}>
          « Les plus belles escapades
          <br />
          commencent par une page. »
        </p>

        <button
          onClick={onFinish}
          className="mt-12 w-full font-bold rounded-full py-4 px-8 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
          style={{ backgroundColor: buttonBg, color: buttonText }}
        >
          Commencer
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 100" preserveAspectRatio="none" style={{ height: "12vh" }}>
        <path d="M0,40 C100,90 300,0 400,55 L400,100 L0,100 Z" fill={waveColor} opacity="0.12" />
      </svg>
    </div>
  );
}
