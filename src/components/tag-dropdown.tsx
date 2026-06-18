"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Liste déroulante à cocher pour les genres/tropes/thèmes — remplace
 * le mur de pastilles toujours déployé (devenu trop long avec des
 * dizaines d'options) par un menu compact qui s'ouvre au clic. Les
 * choix déjà faits restent visibles juste en dessous, sous forme de
 * petites pastilles, même une fois le menu refermé.
 */
export function TagDropdown({
  label,
  options,
  selected,
  onToggle,
  accent = "primary",
  helperText,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  accent?: "primary" | "secondary";
  helperText?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Label className="italic text-2xl font-headline">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between rounded-2xl bg-white/40 border border-primary/10 px-5 py-3 italic text-sm text-primary/70 hover:bg-white/60 transition-colors"
          >
            <span>
              {selected.length > 0 ? `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}` : `Choisir parmi ${options.length} options`}
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0 bg-white/95 backdrop-blur-xl border-none shadow-xl rounded-2xl overflow-hidden" align="start">
          <div className="max-h-80 overflow-y-auto">
            <div className="p-3 space-y-1">
              {options.map((opt) => {
                const isActive = selected.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-primary/5 cursor-pointer italic text-sm transition-colors"
                  >
                    <Checkbox checked={isActive} onCheckedChange={() => onToggle(opt)} />
                    {opt}
                  </label>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              className={cn(
                "text-xs italic px-3 py-1 rounded-full border transition-colors",
                accent === "secondary"
                  ? "bg-secondary/10 text-secondary/70 border-secondary/20 hover:bg-secondary/20"
                  : "bg-primary/10 text-primary/70 border-primary/20 hover:bg-primary/20"
              )}
            >
              {s} ✕
            </button>
          ))}
        </div>
      )}
      {helperText && <p className="text-[10px] text-muted-foreground italic">{helperText}</p>}
    </div>
  );
}
