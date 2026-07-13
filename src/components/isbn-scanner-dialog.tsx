"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ScanBarcode } from "lucide-react";

/**
 * Scan du code-barres (ISBN, format EAN-13) au dos d'un livre physique,
 * via la caméra de l'appareil. Utilise html5-qrcode, déjà présent dans
 * les dépendances mais jusqu'ici jamais branché à une fonctionnalité.
 *
 * Restreint aux formats EAN-13/EAN-8/UPC-A (ceux des codes-barres livres)
 * plutôt qu'à tous les formats supportés par la librairie (QR code y
 * compris) — évite les faux positifs sur un code-barres qui ne serait
 * pas un ISBN, et accélère la détection.
 */
export function IsbnScannerDialog({
  open,
  onOpenChange,
  onScan,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onScan: (isbn: string) => void;
}) {
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStarting(true);

    import("html5-qrcode").then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode("isbn-scanner-region", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
        ],
        verbose: false,
      } as any);
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 130 } },
          (decodedText: string) => {
            // Un seul scan valide suffit — on arrête immédiatement pour
            // ne pas redéclencher en boucle sur la même image.
            onScan(decodedText.replace(/[^0-9]/g, ""));
            onOpenChange(false);
          },
          () => {
            // Échec de lecture sur une image donnée : normal et fréquent
            // pendant la visée, ne pas remonter d'erreur pour ça.
          }
        )
        .then(() => {
          if (!cancelled) setStarting(false);
        })
        .catch((err: any) => {
          console.error("Scanner Start Error:", err);
          if (!cancelled) {
            setError("Impossible d'accéder à la caméra. Vérifie que Lectoria y est autorisée dans les réglages de ton navigateur.");
            setStarting(false);
          }
        });
    });

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-none max-w-md p-8 bg-white/95 backdrop-blur-3xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl italic flex items-center gap-3">
            <ScanBarcode className="h-6 w-6 text-primary" /> Scanner un livre
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs italic opacity-60 -mt-2">
          Vise le code-barres au dos du livre, à environ 15 cm de la caméra.
        </p>
        {error ? (
          <p className="text-sm text-destructive italic py-10 text-center">{error}</p>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black min-h-[220px] flex items-center justify-center">
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
            <div id="isbn-scanner-region" className="w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
