'use server';
/**
 * @fileOverview This file implements a Genkit flow for summarizing a reader's notes on a book
 * and extracting key thematic quotes.
 *
 * - aiNoteSummarization - A function that handles the AI note summarization process.
 * - AiNoteSummarizationInput - The input type for the aiNoteSummarization function.
 * - AiNoteSummarizationOutput - The return type for the aiNoteSummarization function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiNoteSummarizationInputSchema = z.object({
  notes: z
    .string()
    .describe(
      'The raw, scattered notes taken by a reader for a book, including personal thoughts, observations, and direct quotes.'
    ),
});
export type AiNoteSummarizationInput = z.infer<typeof AiNoteSummarizationInputSchema>;

const AiNoteSummarizationOutputSchema = z.object({
  summary: z
    .string()
    .describe('A coherent and personal summary of the book based on the provided notes.'),
  thematicQuotes: z
    .array(z.string())
    .describe('An array of key thematic quotes extracted from the notes.'),
});
export type AiNoteSummarizationOutput = z.infer<typeof AiNoteSummarizationOutputSchema>;

export async function aiNoteSummarization(
  input: AiNoteSummarizationInput
): Promise<AiNoteSummarizationOutput> {
  return aiNoteSummarizationFlow(input);
}

const aiNoteSummarizationPrompt = ai.definePrompt({
  name: 'aiNoteSummarizationPrompt',
  input: {schema: AiNoteSummarizationInputSchema},
  output: {schema: AiNoteSummarizationOutputSchema},
  prompt: `You are an intelligent literary assistant for a reader. Your task is to analyze the provided raw notes from a book, synthesize them into a coherent personal summary, and extract the most important thematic quotes. The output should be formatted as a JSON object with a 'summary' field containing the overall summary and a 'thematicQuotes' field containing an array of strings for the quotes.

Notes: {{{notes}}}`,
});

const aiNoteSummarizationFlow = ai.defineFlow(
  {
    name: 'aiNoteSummarizationFlow',
    inputSchema: AiNoteSummarizationInputSchema,
    outputSchema: AiNoteSummarizationOutputSchema,
  },
  async (input) => {
    const {output} = await aiNoteSummarizationPrompt(input);
    return output!;
  }
);
