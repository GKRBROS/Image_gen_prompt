import 'server-only';

import { readFile } from 'fs/promises';
import { join } from 'path';

const PROMPT_FILE_PATH = join(process.cwd(), 'amb_prompt.txt');

let cachedPromptTemplate: string | null = null;

const normalizePrompt = (value: string) => value.replace(/\r\n/g, '\n').trim();

export const loadAmbitionPromptTemplate = async () => {
  if (cachedPromptTemplate) {
    return cachedPromptTemplate;
  }

  const filePrompt = await readFile(PROMPT_FILE_PATH, 'utf8').catch(() => '');
  const template = filePrompt.trim();

  if (!template) {
    throw new Error(`Missing ambition prompt template at ${PROMPT_FILE_PATH}`);
  }

  cachedPromptTemplate = template;
  return cachedPromptTemplate;
};

export const buildAmbitionPrompt = async (input: {
  profession: string;
  outfit: string;
  prompt: string;
}) => {
  const template = await loadAmbitionPromptTemplate();
  const userPrompt = normalizePrompt(input.prompt);

  return template
    .replace(/\{profession\}/g, input.profession.trim())
    .replace(/\{outfit\}/g, input.outfit.trim())
    .replace(/\{user_prompt\}/g, userPrompt);
};