"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Écran de lancement, affiché une seule fois par session (cf. layout.tsx,
 * via sessionStorage). Affiche le logo officiel Lectoria (livre, plume,
 * et nom déjà intégrés dans l'image fournie — on ne duplique donc plus
 * le texte séparément, pour éviter toute redondance visuelle).
 * Séquence volontairement courte (~1.6s) : un démarrage premium se
 * ressent rapide, pas comme un générique.
 */
export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage(1), 80);   // Apparition du logo
    const timer2 = setTimeout(() => setStage(2), 1400); // Fondu de sortie
    const timer3 = setTimeout(onFinish, 1850);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#fdfaf8] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${
        stage >= 2 ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`relative w-64 h-64 transition-all duration-700 ease-out ${
          stage >= 1 ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
      >
        <Image src="/brand/logo-lectoria.png" alt="Lectoria" fill className="object-contain" priority unoptimized />
      </div>
    </div>
  );
}
