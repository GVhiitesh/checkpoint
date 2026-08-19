import { config } from './config.js';

const MODEL = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function askGemini(question, stats) {
  if (!config.geminiApiKey) throw new Error('no_api_key');

  const prompt = [
    'You are an assistant embedded in an event check-in dashboard.',
    'Answer the organizer\'s question using ONLY the numbers in the DATA block below.',
    'Do not invent, estimate, or recompute any number. If the data does not contain',
    'the answer, say so plainly. Keep the answer to 1-2 short sentences.',
    '',
    'DATA:',
    JSON.stringify(stats, null, 2),
    '',
    `QUESTION: ${question}`,
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(`${ENDPOINT}?key=${config.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.0, maxOutputTokens: 120 },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`gemini_http_${resp.status}`);
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('gemini_empty_response');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
