"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ScanBarcode, Flashlight, FlashlightOff, Keyboard } from "lucide-react";

/**
 * Scan du code-barres (ISBN, format EAN-13) au dos d'un livre physique,
 * via la caméra de l'appareil. Utilise html5-qrcode, déjà présent dans
 * les dépendances mais jusqu'ici jamais branché à une fonctionnalité.
 *
 * Restreint aux formats EAN-13/EAN-8/UPC-A (ceux des codes-barres livres)
 * plutôt qu'à tous les formats supportés par la librairie (QR code y
 * compris) — évite les faux positifs sur un code-barres qui ne serait
 * pas un ISBN, et accélère la détection.
 *
 * Deux ajouts suite aux retours bêta 2 (scanner en échec fréquent) :
 * - Torche manuelle (via l'API caméra de html5-qrcode) quand l'appareil
 *   la supporte — beaucoup d'échecs de scan viennent d'un manque de
 *   lumière plus que d'un défaut de la librairie.
 * - Bascule automatique vers la saisie manuelle après plusieurs échecs
 *   rapprochés : le callback d'échec de html5-qrcode se déclenche à
 *   quasiment CHAQUE frame tant qu'aucun code n'est lu (10 fois/seconde),
 *   ce qui n'a rien à voir avec un "nombre de tentatives" au sens
 *   utilisateur — on ne compte donc qu'un échec au maximum toutes les
 *   1,2s pour approximer de vraies tentatives distinctes.
 *
 * Limite connue et non résolue ici : les codes-barres courbés ou froissés
 * (fréquent sur les livres de poche) restent une limite du décodage 1D
 * de la librairie elle-même, pas un réglage qu'on peut ajuster côté
 * appli — la torche et le repli en saisie manuelle réduisent l'impact
 * sans supprimer la cause.
 */

const FAILURE_DEBOUNCE_MS = 1200;
const FAILURES_BEFORE_MANUAL_FALLBACK = 3;

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
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");
  const lastFailureAtRef = useRef(0);
  const failureCountRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStarting(true);
    setTorchSupported(false);
    setTorchOn(false);
    setShowManualEntry(false);
    setManualIsbn("");
    failureCountRef.current = 0;
    lastFailureAtRef.current = 0;

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
          { fps: 10, qrbox: { width: 280, height: 140 } },
          (decodedText: string) => {
            // Un seul scan valide suffit — on arrête immédiatement pour
            // ne pas redéclencher en boucle sur la même image.
            onScan(decodedText.replace(/[^0-9]/g, ""));
            onOpenChange(false);
          },
          () => {
            // Échec de lecture sur une image donnée : normal et fréquent
            // pendant la visée (jusqu'à 10×/s). On ne compte qu'un échec
            // "réel" toutes les FAILURE_DEBOUNCE_MS pour approximer de
            // vraies tentatives, plutôt que de basculer en saisie
            // manuelle après une fraction de seconde de visée normale.
            const now = Date.now();
            if (now - lastFailureAtRef.current < FAILURE_DEBOUNCE_MS) return;
            lastFailureAtRef.current = now;
            failureCountRef.current += 1;
            if (failureCountRef.current >= FAILURES_BEFORE_MANUAL_FALLBACK) {
              setShowManualEntry(true);
            }
          }
        )
        .then(() => {
          if (cancelled) return;
          setStarting(false);
          try {
            const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
            setTorchSupported(torch.isSupported());
          } catch {
            setTorchSupported(false);
          }
        })
        .catch((err: any) => {
          console.error("Scanner Start Error:", err);
          if (!cancelled) {
            setError("Impossible d'accéder à la caméra. Vérifie que Lectoria y est autorisée dans les réglages de ton navigateur.");
            setStarting(false);
            setShowManualEntry(true);
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

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const torch = scannerRef.current.getRunningTrackCameraCapabilities().torchFeature();
      const next = !torchOn;
      await torch.apply(next);
      setTorchOn(next);
    } catch (err) {
      console.error("Torch Toggle Error:", err);
    }
  };

  const submitManualIsbn = () => {
    const cleaned = manualIsbn.replace(/[^0-9]/g, "");
    if (!cleaned) return;
    onScan(cleaned);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-none max-w-md p-8 bg-white/95 backdrop-blur-3xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl italic flex items-center gap-3">
            <ScanBarcode className="h-6 w-6 text-primary" /> Scanner un livre
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs italic opacity-60 -mt-2">
          Vise le code-barres au dos du livre, à environ 15 cm de la caméra. Aplatis légèrement la couverture si elle
          est incurvée (fréquent sur les poches) — ça aide beaucoup le scan.
        </p>
        {error ? (
          <p className="text-sm text-destructive italic py-6 text-center">{error}</p>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black min-h-[220px] flex items-center justify-center">
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
            <div id="isbn-scanner-region" className="w-full" />
            {torchSupported && !starting && (
              <button
                onClick={toggleTorch}
                title={torchOn ? "Éteindre la torche" : "Allumer la torche"}
                className="absolute bottom-3 right-3 z-20 h-11 w-11 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-primary hover:scale-110 transition-transform"
              >
                {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
              </button>
            )}
          </div>
        )}

        {!showManualEntry ? (
          <button
            onClick={() => setShowManualEntry(true)}
            className="mx-auto flex items-center gap-2 text-xs italic text-primary/60 hover:text-primary transition-colors pt-1"
          >
            <Keyboard className="h-3.5 w-3.5" /> Saisir le numéro ISBN à la main
          </button>
        ) : (
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 text-center">
              {failureCountRef.current >= FAILURES_BEFORE_MANUAL_FALLBACK
                ? "Le scan a du mal — saisis le numéro à la main"
                : "Saisir le numéro ISBN"}
            </p>
            <div className="flex gap-2">
              <Input
                value={manualIsbn}
                onChange={(e) => setManualIsbn(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitManualIsbn(); }}
                inputMode="numeric"
                placeholder="978..."
                className="h-11 italic bg-white/60 rounded-xl border-none shadow-inner"
                autoFocus
              />
              <Button onClick={submitManualIsbn} disabled={!manualIsbn.trim()} className="h-11 px-5 rounded-xl bg-primary shrink-0">
                OK
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
