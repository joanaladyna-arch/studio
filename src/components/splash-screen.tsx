"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Écran de lancement, affiché une seule fois par session (cf. layout.tsx,
 * via sessionStorage). Affiche le logo officiel Lectoria. Le carré rose
 * du logo est volontairement "fondu" dans le fond crème de l'écran via
 * un masque radial — ses bords s'estompent en transparence plutôt que
 * de former un bloc net, pour une apparition plus douce et intégrée.
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

  const fadeMask = {
    maskImage: "radial-gradient(circle, black 55%, transparent 85%)",
    WebkitMaskImage: "radial-gradient(circle, black 55%, transparent 85%)",
  };

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#fdfaf8] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-700 ${
        stage >= 2 ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`relative w-72 h-72 transition-opacity duration-[1400ms] ease-out ${
          stage >= 1 ? "opacity-100" : "opacity-0"
        }`}
        style={fadeMask}
      >
        <Image src="/brand/logo-lectoria.png" alt="Lectoria" fill className="object-contain" priority unoptimized />
      </div>
    </div>
  );
}
