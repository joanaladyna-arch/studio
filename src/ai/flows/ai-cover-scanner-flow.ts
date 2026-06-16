
'use server';
/**
 * @fileOverview Flux d'IA pour identifier un livre à partir d'une photo de sa couverture.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiCoverScannerInputSchema = z.object({
  photoDataUri: z.string().describe("La photo de la couverture du livre au format data URI base64."),
});

const AiCoverScannerOutputSchema = z.object({
  title: z.string().describe("Le titre identifié du livre."),
  author: z.string().describe("L'auteur identifié du livre."),
  confidence: z.number().describe("Le niveau de confiance de l'identification entre 0 et 1."),
});

export type AiCoverScannerInput = z.infer<typeof AiCoverScannerInputSchema>;
export type AiCoverScannerOutput = z.infer<typeof AiCoverScannerOutputSchema>;

export async function aiCoverScanner(input: AiCoverScannerInput): Promise<AiCoverScannerOutput> {
  return aiCoverScannerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'coverScannerPrompt',
  input: { schema: AiCoverScannerInputSchema },
  output: { schema: AiCoverScannerOutputSchema },
  prompt: `Analysez cette photo de couverture de livre. Identifiez le titre et l'auteur. 
Si vous n'êtes pas sûr, donnez vos meilleures suppositions basées sur le texte visible.

Photo: {{media url=photoDataUri}}`,
});

const aiCoverScannerFlow = ai.defineFlow(
  {
    name: 'aiCoverScannerFlow',
    inputSchema: AiCoverScannerInputSchema,
    outputSchema: AiCoverScannerOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("Impossible d'identifier le livre sur cette photo.");
    }
    return output;
  }
);
