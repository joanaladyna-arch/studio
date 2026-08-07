"use client";

import { useRef, useState } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ImagePlus, Sparkles } from "lucide-react";
import { stableBookKey } from "@/lib/utils";

/**
 * Import d'annonces de sorties par capture d'écran (posts Instagram
 * d'éditeurs, pages catalogue...) : envoie les images à l'API vision de
 * Claude côté serveur (/api/admin/vision-import) pour en extraire
 * titre/auteur/éditeur/date, puis dépose chaque livre trouvé dans
 * `actualitesPending` — jamais publié directement, même flux de
 * validation que les autres sources automatiques.
 *
 * Choix volontaire : ne récupère JAMAIS de couverture depuis la capture
 * (rognage automatique peu fiable). L'administratrice ajoute elle-même
 * l'image lors de la validation, voir AdminActualitesQueue.
 */
export function VisionImportManager({ onImported }: { onImported?: () => void }) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ added: number; duplicates: number; imagesWithoutBook: number; errors: string[] } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    setFiles(list);
    setSelectedCount(list.length);
    setResults(null);
  };

  // Redimensionne et recompresse systématiquement en JPEG avant l'envoi :
  // évite de dépasser la limite de taille de l'API vision Anthropic
  // (captures d'écran haute résolution/Retina) et garantit un format
  // toujours supporté, quel que soit le format d'origine (PNG, HEIC...).
  const fileToBase64 = (file: File): Promise<{ base64: string; mediaType: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX_DIM = 1568;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        URL.revokeObjectURL(url);
        if (!ctx) {
          reject(new Error(`Impossible de traiter l'image : ${file.name}`));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ base64: dataUrl.split(",")[1] || "", mediaType: "image/jpeg" });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Format d'image non supporté : ${file.name}`));
      };
      img.src = url;
    });
  };

  const runImport = async () => {
    if (!db || !user || files.length === 0) return;
    setIsProcessing(true);
    setResults(null);
    try {
      const images = await Promise.all(files.map(fileToBase64));
      const idToken = await user.getIdToken();

      const res = await fetch("/api/admin/vision-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ images }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const extracted: { title: string; author: string; publisher: string; releaseDate: string; content: string; sourceImageIndex: number }[] = data.results || [];

      // Titres déjà connus (publiés ou en attente), même logique que le
      // cron : jamais proposer deux fois le même livre.
      const [actualitesSnap, pendingSnap] = await Promise.all([
        getDocs(collection(db, "actualites")),
        getDocs(collection(db, "actualitesPending")),
      ]);
      const knownKeys = new Set<string>();
      actualitesSnap.forEach((d) => knownKeys.add(stableBookKey(d.data()?.title, d.data()?.authorName)));
      pendingSnap.forEach((d) => knownKeys.add(stableBookKey(d.data()?.title, d.data()?.authorName)));

      let added = 0;
      let duplicates = 0;
      const imagesWithBook = new Set<number>();

      for (const item of extracted) {
        const title = (item.title || "").trim();
        if (!title) continue;
        imagesWithBook.add(item.sourceImageIndex);

        const key = stableBookKey(title, item.author);
        if (knownKeys.has(key)) { duplicates++; continue; }

        const docRef = doc(collection(db, "actualitesPending"));
        await setDoc(docRef, {
          title,
          authorName: item.author || "",
          publisherName: item.publisher || "",
          content: item.content || `Annonce détectée par capture d'écran : ${title}${item.author ? ` de ${item.author}` : ""}.`,
          cover: "",
          isRelease: Boolean(item.releaseDate),
          releaseDate: item.releaseDate || "",
          source: "auto-vision-import",
          detectedAt: serverTimestamp(),
        });
        knownKeys.add(key);
        added++;
      }

      const imagesWithoutBook = images.length - imagesWithBook.size;
      const apiErrors: { imageIndex: number; message: string }[] = data.errors || [];
      const errorMessages = apiErrors.map((e) => `Image ${e.imageIndex + 1} (${files[e.imageIndex]?.name || "?"}) : ${e.message}`);
      setResults({ added, duplicates, imagesWithoutBook, errors: errorMessages });
      if (errorMessages.length > 0) {
        toast({
          variant: "destructive",
          title: "Import terminé avec des erreurs",
          description: `${added} livre(s) ajouté(s), ${errorMessages.length} image(s) en erreur.`,
        });
      } else {
        toast({ title: "Import terminé", description: `${added} livre(s) ajouté(s) en attente de validation.` });
      }
      onImported?.();
    } catch (err) {
      console.error("Vision Import Error:", err);
      toast({ variant: "destructive", title: "Erreur d'import", description: (err as any)?.message });
    } finally {
      setIsProcessing(false);
      setFiles([]);
      setSelectedCount(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-headline italic flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary" /> Importer depuis des captures d'écran
      </h3>
      <p className="text-xs italic opacity-60">
        Sélectionne une ou plusieurs captures (posts éditeurs, pages catalogue...) — Claude en extrait titre, auteur,
        éditeur et date, et dépose chaque livre trouvé en attente de validation. Les couvertures ne sont pas
        récupérées automatiquement : tu les ajoutes toi-même en validant.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="h-11 rounded-xl italic font-headline border-primary/20"
        >
          <ImagePlus className="mr-2 h-4 w-4" /> Choisir des captures
        </Button>
        {selectedCount > 0 && (
          <span className="text-xs opacity-60">{selectedCount} image(s) sélectionnée(s)</span>
        )}
        <Button
          onClick={runImport}
          disabled={isProcessing || selectedCount === 0}
          className="h-11 rounded-xl italic font-headline bg-primary"
        >
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Analyser {selectedCount > 0 ? `(${selectedCount})` : ""}
        </Button>
      </div>
      {results && (
        <div className="space-y-1">
          <p className="text-xs opacity-60 italic">
            {results.added} livre(s) ajouté(s), {results.duplicates} doublon(s) ignoré(s), {results.imagesWithoutBook}{" "}
            image(s) sans annonce détectée.
          </p>
          {results.errors.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5">
              {results.errors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
