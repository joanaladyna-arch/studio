'use server';
/**
 * @fileOverview An AI literary advisor that generates reflection questions and book suggestions.
 *
 * - aiLiteraryAdvisor - A function that generates reflection questions and book suggestions.
 * - AiLiteraryAdvisorInput - The input type for the aiLiteraryAdvisor function.
 * - AiLiteraryAdvisorOutput - The return type for the aiLiteraryAdvisor function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiLiteraryAdvisorInputSchema = z.object({
  bookTitle: z.string().describe('The title of the book the user has read.'),
  bookAuthor: z.string().describe('The author of the book the user has read.'),
  bookGenre: z.string().describe('The genre of the book the user has read.'),
  userReadingHistory: z
    .array(z.string())
    .optional()
    .describe('A list of other books the user has read, used for recommendations.'),
  userPreferences: z
    .string()
    .optional()
    .describe('User expressed preferences for book recommendations (e.g., favorite genres, themes).'),
});
export type AiLiteraryAdvisorInput = z.infer<typeof AiLiteraryAdvisorInputSchema>;

const AiLiteraryAdvisorOutputSchema = z.object({
  reflectionQuestions: z
    .array(z.string())
    .describe('A list of thoughtful questions to help the user reflect on the book.'),
  suggestedBooks: z
    .array(
      z.object({
        title: z.string().describe('The title of the suggested book.'),
        author: z.string().describe('The author of the suggested book.'),
        reason: z.string().describe('A brief explanation of why this book is suggested.'),
      })
    )
    .describe('A list of book recommendations based on the user\'s input.'),
});
export type AiLiteraryAdvisorOutput = z.infer<typeof AiLiteraryAdvisorOutputSchema>;

export async function aiLiteraryAdvisor(input: AiLiteraryAdvisorInput): Promise<AiLiteraryAdvisorOutput> {
  return aiLiteraryAdvisorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'literaryAdvisorPrompt',
  input: {schema: AiLiteraryAdvisorInputSchema},
  output: {schema: AiLiteraryAdvisorOutputSchema},
  prompt: `You are an AI literary advisor. Your task is to help readers deepen their understanding of a book they've read and discover new titles.

First, generate a list of thoughtful reflection questions about the book the user has just read. These questions should encourage critical thinking, emotional engagement, and a deeper analysis of the book's themes, characters, and plot.

Then, suggest new books based on the user's reading history and preferences. Provide a brief reason for each suggestion.

Here are the details:

Book Just Read:
Title: {{{bookTitle}}}
Author: {{{bookAuthor}}}
Genre: {{{bookGenre}}}

{{#if userReadingHistory}}
User's Reading History (other books read):
{{#each userReadingHistory}}- {{{this}}}
{{/each}}
{{/if}}

{{#if userPreferences}}
User's Preferences for Recommendations: {{{userPreferences}}}
{{/if}}

Ensure your output strictly adheres to the provided JSON schema for reflectionQuestions and suggestedBooks.`,
});

const aiLiteraryAdvisorFlow = ai.defineFlow(
  {
    name: 'aiLiteraryAdvisorFlow',
    inputSchema: AiLiteraryAdvisorInputSchema,
    outputSchema: AiLiteraryAdvisorOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
