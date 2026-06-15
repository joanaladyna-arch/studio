"use client";

import { useEffect, useState } from "react";
import { Book, Feather } from "lucide-react";

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage(1), 500); // Plumes tombent
    const timer2 = setTimeout(() => setStage(2), 2500); // Assemblage Livres
    const timer3 = setTimeout(() => setStage(3), 3500); // Fin
    const timer4 = setTimeout(onFinish, 4200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#fdfaf8] flex flex-col items-center justify-center overflow-hidden">
      {/* Plumes qui tombent (Stage 1) */}
      {stage >= 1 && stage < 2 && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-feather"
              style={{
                left: `${15 + i * 15}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            >
              <Feather className="w-8 h-8 text-primary/30" />
            </div>
          ))}
        </div>
      )}

      {/* Pile de livres (Stage 2) */}
      <div className={`transition-all duration-1000 transform flex flex-col items-center ${
        stage >= 2 ? "scale-100 opacity-100" : "scale-50 opacity-0"
      }`}>
        <div className="relative mb-4">
          <Book className="w-16 h-16 text-primary/40 absolute -bottom-2 -left-2 rotate-[-10deg]" />
          <Book className="w-16 h-16 text-secondary/40 absolute -bottom-1 left-1 rotate-[5deg]" />
          <Book className="w-16 h-16 text-accent/60 relative z-10" />
        </div>
        <h1 className="text-4xl font-headline tracking-widest text-primary/80">PLUME</h1>
      </div>

      {/* Fade out total (Stage 3) */}
      <div className={`fixed inset-0 bg-white transition-opacity duration-700 ${stage >= 3 ? "opacity-100" : "opacity-0 pointer-events-none"}`} />
    </div>
  );
}