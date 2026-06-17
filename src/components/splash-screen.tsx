"use client";

import { useEffect, useState } from "react";
import { Feather } from "lucide-react";

/**
 * Écran de lancement, affiché une seule fois par session (cf. layout.tsx,
 * via sessionStorage). Repensé pour reprendre le logo Feather établi
 * (icône de l'app, repli des couvertures) plutôt que trois icônes Book
 * superposées en faible opacité, qui se brouillaient visuellement en
 * un aplat flou et peu lisible. Séquence volontairement courte (~1.6s) :
 * un démarrage premium se ressent rapide, pas comme un générique.
 */
export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage(1), 80);   // Icône
    const timer2 = setTimeout(() => setStage(2), 500);  // Nom + sous-titre
    const timer3 = setTimeout(() => setStage(3), 1400); // Fondu de sortie
    const timer4 = setTimeout(onFinish, 1850);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#fdfaf8] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${
        stage >= 3 ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="relative flex flex-col items-center">
        <div
          className={`relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-700 ease-out ${
            stage >= 1 ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.16) 0%, hsl(var(--primary) / 0) 75%)",
          }}
        >
          <Feather className="w-11 h-11 text-primary" strokeWidth={1.75} />
        </div>

        <h1
          className={`mt-6 text-3xl font-headline tracking-[0.2em] text-primary transition-all duration-500 ease-out ${
            stage >= 2 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          LECTORIA
        </h1>
        <p
          className={`mt-2 text-[11px] uppercase tracking-[0.25em] text-primary/50 transition-all duration-500 delay-150 ease-out ${
            stage >= 2 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          Journal de lecture
        </p>
      </div>
    </div>
  );
}
