"use client";

import { ArrowRight } from "lucide-react";

/**
 * Écran d'ouverture, affiché une seule fois par session (cf. layout.tsx,
 * via sessionStorage) avant d'accéder à l'app — connecté(e) ou non.
 * Le bouton "Commencer" ne navigue pas en dur vers /login : il appelle
 * onFinish, qui referme cet écran et laisse le flux normal (AuthGuard)
 * décider de la suite — bibliothèque si déjà connecté, connexion sinon.
 */
export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] overflow-hidden flex flex-col items-center justify-center px-8 text-center bg-gradient-to-b from-[#1B2430] to-[#2A3644]">
      <div className="relative z-10 flex flex-col items-center max-w-sm animate-in fade-in duration-700">
        <svg width="120" height="140" viewBox="0 0 120 140" fill="none" className="mb-10 drop-shadow-sm">
          <path
            d="M60 20 C45 35 38 55 40 78 C42 60 50 48 60 30 C58 50 52 64 44 78 C56 76 66 66 70 50 C72 40 70 28 60 20 Z"
            stroke="#D98BA0" strokeWidth="3" strokeLinejoin="round" fill="none"
          />
          <rect x="14" y="92" width="92" height="22" rx="11" stroke="white" strokeWidth="3" fill="none" />
          <path d="M22 103 H98" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        </svg>

        <h1 className="font-headline text-5xl italic text-white">Bienvenue</h1>

        <div className="flex items-center gap-3 my-5 w-40">
          <div className="h-px flex-1 bg-white/40" />
          <div className="h-1.5 w-1.5 rounded-full bg-[#D98BA0]/70" />
          <div className="h-px flex-1 bg-white/40" />
        </div>

        <p className="font-headline italic text-lg text-white/85 leading-relaxed">
          « Les plus belles escapades
          <br />
          commencent par une page. »
        </p>

        <button
          onClick={onFinish}
          className="mt-12 w-full bg-[#F5F1E8] text-[#1B2430] font-bold rounded-full py-4 px-8 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
        >
          Commencer
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 100" preserveAspectRatio="none" style={{ height: "12vh" }}>
        <path d="M0,40 C100,90 300,0 400,55 L400,100 L0,100 Z" fill="#B08457" opacity="0.12" />
      </svg>
    </div>
  );
}
