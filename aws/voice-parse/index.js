const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} = require('@aws-sdk/client-transcribe-streaming');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const MODEL_IDS = (process.env.BEDROCK_MODEL_IDS || 'apac.amazon.nova-lite-v1:0,apac.amazon.nova-micro-v1:0')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const SYSTEM_PROMPT = `You parse messy spoken commands for Rozka — a personal task app. Input is from speech-to-text: expect typos, missing words, Hindi, English, or Hinglish mixed.

Return ONLY valid JSON (no markdown):
{"actions":[...]}

Action types:
- task: {"type":"task","title":"...","area":"PERSONAL"|"WORK"|"HOME","remind":true|false,"dueDate":"YYYY-MM-DD"}
- reminder: {"type":"reminder","title":"...","dueDate":"YYYY-MM-DD","repeat":"NONE"|"MONTHLY"|"YEARLY"}
- expense: {"type":"expense","amount":number,"description":"...","categoryId":"cat-groceries"|"cat-dining"|"cat-transport"|"cat-utilities"|"cat-health"|"cat-entertainment"|"cat-shopping"|"cat-other"}
- shopping: {"type":"shopping","name":"..."}
- note: {"type":"note","content":"..."}

Understanding rules (IMPORTANT):
- Fix speech errors and bad pronunciation — map sounds to intent, not literal spelling:
  doodh/dud/dudh/dood/milk → "Order milk"
  sabzi/sabjee/savvy/sabji/veggie/vegetable/sabji → "Order vegetables" or "Sabzi order"
  anda/anday/egg → eggs shopping or task
  bill/bijli/bijlee/electric → pay electricity bill
  pani/paani/water → drink water task
  dawa/dawai/medicine → medicine task or shopping
  kapde/kapda/laundry → laundry task
  subah/subah ka / morning → morning routine tasks
  task/tasq/tax/ask → task (ignore misheard word)
- "2 task" / "do task" / "dono" / "pehla doosra" / numbered list → split into separate task actions.
- remind / yaad / yaad dilana / reminder / notification / yaad rakhna → remind:true on tasks OR add reminder actions.
- kal → tomorrow, parso → day after tomorrow, aaj → today (use context.today and context.selectedDate).
- Default dueDate = context.selectedDate unless user gives another date.
- Short clear English or Hindi titles (e.g. "Doodh mangwana", "Order milk", "Pay electricity bill").
- If user clearly wants shopping (kharidna, lana, buy, shopping list) use shopping type.
- If amount + money words (rs, rupaye, kharch, spent) use expense.
- When intent is unclear but sounds like a todo → create a task rather than returning empty.
- Ignore filler: please, kripya, ok, um, matlab, basically, rozka, add karo, bana do.

Examples:
Input: "please create 2 task order milk and order veggie also remind me"
→ two tasks with remind:true

Input: "doodh aur sabzi ka order karo yaad dilana"
→ tasks: Order milk + Order sabzi, both remind:true

Input: "50 rupaye chai par kharch"
→ expense 50, cat-dining, description chai

Input: "shopping anda bread"
→ shopping eggs, shopping bread OR one shopping "anda, bread" — prefer separate shopping items if two things listed.`;

const MORNING_SETUP_PROMPT = `You build a short morning task list for Rozka — a simple personal day planner.

Return ONLY valid JSON (no markdown):
{"actions":[...]}

Each action must be:
{"type":"task","title":"short clear title","area":"PERSONAL"|"WORK"|"HOME","dueDate":"YYYY-MM-DD"}

Rules:
- dueDate = context.today unless specified otherwise
- If context.routines is a non-empty array, turn each routine line into a task (dedupe similar titles)
- If routines empty, suggest 3–5 gentle morning tasks (plan day, drink water, breakfast, etc.)
- Prefer Hindi titles if lang is hi-IN, English if en-US; keep titles under 6 words
- Max 8 tasks total
- No reminders, expenses, or shopping — tasks only`;

function response(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

function extractJson(text) {
  const trimmed = (text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Model did not return JSON');
  }
}

const VALID_AREAS = new Set(['PERSONAL', 'WORK', 'HOME']);
const VALID_CATEGORIES = new Set([
  'cat-groceries',
  'cat-dining',
  'cat-transport',
  'cat-utilities',
  'cat-health',
  'cat-entertainment',
  'cat-shopping',
  'cat-other',
]);
const VALID_REPEAT = new Set(['NONE', 'MONTHLY', 'YEARLY']);

function sanitizeActions(raw, selectedDate) {
  if (!Array.isArray(raw)) return [];
  const out = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    switch (item.type) {
      case 'task': {
        const title = String(item.title || '').trim();
        if (title.length < 2) break;
        out.push({
          type: 'task',
          title,
          area: VALID_AREAS.has(item.area) ? item.area : 'PERSONAL',
          remind: Boolean(item.remind),
          dueDate: typeof item.dueDate === 'string' ? item.dueDate : selectedDate,
        });
        break;
      }
      case 'reminder': {
        const title = String(item.title || '').trim();
        if (title.length < 2) break;
        out.push({
          type: 'reminder',
          title,
          dueDate: typeof item.dueDate === 'string' ? item.dueDate : selectedDate,
          repeat: VALID_REPEAT.has(item.repeat) ? item.repeat : 'NONE',
          notes: typeof item.notes === 'string' ? item.notes : undefined,
        });
        break;
      }
      case 'expense': {
        const amount = Number(item.amount);
        const description = String(item.description || 'Expense').trim();
        if (!Number.isFinite(amount) || amount <= 0) break;
        out.push({
          type: 'expense',
          amount,
          description,
          categoryId: VALID_CATEGORIES.has(item.categoryId) ? item.categoryId : 'cat-other',
        });
        break;
      }
      case 'shopping': {
        const name = String(item.name || '').trim();
        if (name.length < 2) break;
        out.push({ type: 'shopping', name });
        break;
      }
      case 'note': {
        const content = String(item.content || '').trim();
        if (content.length < 2) break;
        out.push({ type: 'note', content });
        break;
      }
      default:
        break;
    }
  }

  return out;
}

async function invokeModel(client, modelId, transcript, lang, context, systemPrompt = SYSTEM_PROMPT) {
  const userPayload = JSON.stringify({ transcript, lang, context });
  const command = new ConverseCommand({
    modelId,
    system: [{ text: systemPrompt }],
    messages: [{ role: 'user', content: [{ text: userPayload }] }],
    inferenceConfig: { maxTokens: 1800, temperature: 0.15 },
  });
  const result = await client.send(command);
  const text = result.output?.message?.content?.map((c) => c.text).filter(Boolean).join('') || '';
  const parsed = extractJson(text);
  return sanitizeActions(parsed.actions, context.selectedDate || context.today);
}

async function invokeMorningSetup(client, modelId, lang, context) {
  const userPayload = JSON.stringify({ mode: 'morning_setup', lang, context });
  const command = new ConverseCommand({
    modelId,
    system: [{ text: MORNING_SETUP_PROMPT }],
    messages: [{ role: 'user', content: [{ text: userPayload }] }],
    inferenceConfig: { maxTokens: 1200, temperature: 0.2 },
  });
  const result = await client.send(command);
  const text = result.output?.message?.content?.map((c) => c.text).filter(Boolean).join('') || '';
  const parsed = extractJson(text);
  return sanitizeActions(parsed.actions, context.today || context.selectedDate);
}

async function transcribePcm(pcmBuffer, languageCode, sampleRateHertz) {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const client = new TranscribeStreamingClient({ region });
  const chunkSize = 6400;

  async function* audioStream() {
    for (let i = 0; i < pcmBuffer.length; i += chunkSize) {
      yield {
        AudioEvent: {
          AudioChunk: pcmBuffer.subarray(i, Math.min(i + chunkSize, pcmBuffer.length)),
        },
      };
    }
  }

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: languageCode,
    MediaEncoding: 'pcm',
    MediaSampleRateHertz: sampleRateHertz,
    AudioStream: audioStream(),
  });

  const result = await client.send(command);
  let transcript = '';
  if (result.TranscriptResultStream) {
    for await (const event of result.TranscriptResultStream) {
      const results = event.TranscriptEvent?.Transcript?.Results;
      if (!results) continue;
      for (const r of results) {
        if (!r.IsPartial && r.Alternatives?.[0]?.Transcript) {
          transcript += `${r.Alternatives[0].Transcript} `;
        }
      }
    }
  }
  return transcript.trim();
}

async function parseTranscript(transcript, lang, context) {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const client = new BedrockRuntimeClient({ region });
  let lastError = null;

  for (const modelId of MODEL_IDS) {
    try {
      const actions = await invokeModel(client, modelId, transcript, lang, context);
      return { actions, model: modelId };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Bedrock parse failed');
}

async function parseMorningSetup(lang, context) {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const client = new BedrockRuntimeClient({ region });
  let lastError = null;

  for (const modelId of MODEL_IDS) {
    try {
      const actions = await invokeMorningSetup(client, modelId, lang, context);
      return { actions, model: modelId };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Morning setup failed');
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (method !== 'POST') {
    return response(404, { ok: false, error: 'Not found' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { ok: false, error: 'Invalid JSON' });
  }

  const lang = payload.lang === 'en-US' ? 'en-US' : 'hi-IN';
  const today = typeof payload.context?.today === 'string' ? payload.context.today : new Date().toISOString().slice(0, 10);
  const selectedDate =
    typeof payload.context?.selectedDate === 'string' ? payload.context.selectedDate : today;
  const routines = Array.isArray(payload.context?.routines) ? payload.context.routines : [];
  const context = { today, selectedDate, lang, routines };

  if (payload.mode === 'morning_setup') {
    try {
      const { actions, model } = await parseMorningSetup(lang, context);
      return response(200, { ok: true, actions, model });
    } catch (err) {
      const message = err?.message || 'Morning setup failed';
      return response(500, { ok: false, error: message });
    }
  }

  const transcriptInput = String(payload.transcript || '').trim();
  let transcript = transcriptInput;

  if (payload.audioBase64) {
    try {
      const pcm = Buffer.from(String(payload.audioBase64), 'base64');
      const sampleRate = Number(payload.sampleRate) || 16000;
      transcript = await transcribePcm(pcm, lang, sampleRate);
    } catch (err) {
      const message = err?.message || 'Transcription failed';
      const friendly = message.includes('subscription')
        ? 'Amazon Transcribe not enabled yet (one-time free AWS setup, not a paid plan)'
        : message;
      return response(500, {
        ok: false,
        error: friendly,
        hint: message.includes('subscription')
          ? 'Use keyboard dictation on iPhone, or enable Transcribe once in AWS Console'
          : undefined,
      });
    }
  }

  if (transcript.length < 2) {
    return response(400, { ok: false, error: 'Could not hear speech — speak clearly and try again' });
  }

  try {
    const { actions, model } = await parseTranscript(transcript, lang, context);
    return response(200, { ok: true, transcript, actions, model });
  } catch (err) {
    const message = err?.message || 'Bedrock parse failed';
    const hint =
      message.includes('AccessDenied') || message.includes('ResourceNotFound')
        ? 'Enable Amazon Nova in Bedrock console (Model access) for ap-south-1'
        : undefined;
    return response(500, { ok: false, error: message, hint, transcript });
  }
};
