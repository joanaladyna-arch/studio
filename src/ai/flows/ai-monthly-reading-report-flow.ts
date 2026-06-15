'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a personalized monthly reading report.
 *
 * - generateMonthlyReadingReport - A function that handles the generation of the monthly reading report.
 * - MonthlyReadingReportInput - The input type for the generateMonthlyReadingReport function.
 * - MonthlyReadingReportOutput - The return type for the generateMonthlyReadingReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MonthlyReadingReportInputSchema = z.object({
  month: z
    .string()
    .describe(
      'The month and year for which the report is being generated (e.g., "January 2024").'
    ),
  readingData: z
    .array(
      z.object({
        bookTitle: z.string().describe('The title of the book.').default('Unknown Title'),
        author: z.string().describe('The author of the book.').default('Unknown Author'),
        genre: z.string().describe('The genre of the book.').default('General'),
        pagesOrDuration: z
          .string()
          .describe(
            'Number of pages read or duration listened (e.g., "350 pages", "10 hours").'
          ),
        status: z
          .enum(['completed', 'in_progress', 'dnf'])
          .describe('The reading status of the book for the month.'),
        notes: z
          .string()
          .optional()
          .describe('User notes or highlights for this book during the month.'),
      })
    )
    .optional()
    .describe(
      'An array of objects, each representing a book or reading session for the month.'
    ),
  overallGoalsAchieved: z
    .string()
    .optional()
    .describe(
      'A summary of reading goals achieved or progress made for the month.'
    ),
  favoriteQuotes: z
    .array(z.string())
    .optional()
    .describe('A list of favorite quotes from books read this month.'),
});

export type MonthlyReadingReportInput = z.infer<
  typeof MonthlyReadingReportInputSchema
>;

const MonthlyReadingReportOutputSchema = z.object({
  reportTitle: z
    .string()
    .describe('A personalized and engaging title for the monthly reading report.'),
  narrativeSummary: z
    .string()
    .describe(
      'A comprehensive, personalized narrative report summarizing the reading journey, habits, and progress for the month.'
    ),
  keyInsights: z
    .array(z.string())
    .describe(
      'Key insights and observations about the reader\'s habits, preferences, and patterns based on the data.'
    ),
  readingRecommendations: z
    .array(z.string())
    .describe(
      'Personalized reading recommendations or genre suggestions for the next month based on the analysis.'
    ),
  monthlyStats: z.object({
    totalBooksCompleted: z
      .number()
      .int()
      .describe('The total number of books completed during the month.'),
    totalReadingUnits: z
      .string()
      .describe('Total pages read or hours listened (e.g., "1200 pages", "45 hours").'),
    mostReadGenre: z
      .string()
      .describe('The genre most frequently read this month.')
      .default('N/A'),
    longestBookRead: z
      .string()
      .optional()
      .describe(
        'The title of the longest book read or completed this month, if applicable.'
      ),
  }),
});

export type MonthlyReadingReportOutput = z.infer<
  typeof MonthlyReadingReportOutputSchema
>;

export async function generateMonthlyReadingReport(
  input: MonthlyReadingReportInput
): Promise<MonthlyReadingReportOutput> {
  return generateMonthlyReadingReportFlow(input);
}

const monthlyReadingReportPrompt = ai.definePrompt({
  name: 'monthlyReadingReportPrompt',
  input: { schema: MonthlyReadingReportInputSchema },
  output: { schema: MonthlyReadingReportOutputSchema },
  prompt: `You are Plume, an intelligent literary assistant specialized in crafting personalized and inspiring monthly reading reports. Your goal is to analyze the provided reading data for the month and present it in a narrative, encouraging, and insightful manner, celebrating the reader's journey.

The report should be structured as follows:
1.  **Report Title**: A catchy and personal title.
2.  **Narrative Summary**: A detailed, engaging narrative that summarizes the reader's journey.
    *   Highlight books completed, books in progress, and any DNF books.
    *   Mention total reading units (pages/hours) and genres explored.
    *   Integrate user's notes and favorite quotes to personalize the summary, showing reflections, emotions, or key takeaways.
    *   Acknowledge any overall goals achieved.
    *   Maintain a positive, encouraging, and appreciative tone.
3.  **Key Insights**: Provide 3-5 bullet points of observations about the reader's habits (e.g., "You tend to favor historical fiction during the first half of the month," "Your notes show a deep engagement with character development").
4.  **Reading Recommendations**: Offer 1-3 personalized book recommendations or genre suggestions for the next month based on the identified patterns and preferences.
5.  **Monthly Stats**: A concise summary of quantitative achievements.

Analyze the following reading data for {{{month}}}:

{{#if readingData}}
Reading Sessions:
{{#each readingData}}
  - Book: {{{bookTitle}}} by {{{author}}}
  - Genre: {{{genre}}}
  - Progress: {{{pagesOrDuration}}}
  - Status: {{{status}}}
  {{#if notes}}
  - Notes: {{{notes}}}
  {{/if}}
{{/each}}
{{else}}
No detailed reading data provided.
{{/if}}

{{#if overallGoalsAchieved}}
Overall Goals Achieved/Progress: {{{overallGoalsAchieved}}}
{{/if}}

{{#if favoriteQuotes}}
Favorite Quotes:
{{#each favoriteQuotes}}
  - "{{{this}}}"
{{/each}}
{{/if}}

If no specific reading data is provided, generate a general encouraging message about reading and set relevant stats to 0 or "N/A".
Ensure the output strictly adheres to the provided JSON schema.`,
});

const generateMonthlyReadingReportFlow = ai.defineFlow(
  {
    name: 'generateMonthlyReadingReportFlow',
    inputSchema: MonthlyReadingReportInputSchema,
    outputSchema: MonthlyReadingReportOutputSchema,
  },
  async (input) => {
    const { output } = await monthlyReadingReportPrompt(input);
    return output!;
  }
);
