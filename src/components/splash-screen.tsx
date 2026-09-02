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
  const markColor = theme ? theme.ink : "#F5F1E8";
  const accentColor = theme ? theme.accent : "#D98BA0";
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
        <div
          className="mb-10 drop-shadow-sm"
          style={{
            width: 140, height: 140,
            backgroundColor: markColor,
            WebkitMaskImage: "url(/logo-icon.png)", maskImage: "url(/logo-icon.png)",
            WebkitMaskSize: "contain", maskSize: "contain",
            WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
            WebkitMaskPosition: "center", maskPosition: "center",
          }}
        />

        <h1 className="font-headline text-5xl italic" style={{ color: textColor }}>Bienvenue</h1>

        <div className="flex items-center gap-3 my-5 w-40">
          <div className="h-px flex-1" style={{ backgroundColor: textColor, opacity: 0.4 }} />
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor, opacity: 0.7 }} />
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
