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

const SYSTEM_PROMPT = `You parse messy spoken commands for Rozka AI — an AI life companion app. Input is from speech-to-text: expect SEVERE typos, corrupted numbers, missing words, Hindi, English, or Hinglish mixed.

CRITICAL: Speech-to-text is VERY unreliable. You MUST:
1. RECONSTRUCT intent from garbled text — don't take words literally
2. FIX corrupted numbers: D00000/D0000/d000 → likely 200-2000, O00/Oo → likely 100, etc.
3. Map phonetically similar garbage to real Hindi words
4. If something SOUNDS like a number pattern (D + zeros, or letters + numbers), interpret as a rupee amount

Return ONLY valid JSON (no markdown):
{"actions":[...]}

Action types:
- task: {"type":"task","title":"...","area":"PERSONAL"|"WORK"|"HOME","remind":true|false,"dueDate":"YYYY-MM-DD"}
- reminder: {"type":"reminder","title":"...","dueDate":"YYYY-MM-DD","repeat":"NONE"|"MONTHLY"|"YEARLY"}
- expense: {"type":"expense","amount":number,"description":"...","categoryId":"cat-groceries"|"cat-dining"|"cat-transport"|"cat-utilities"|"cat-health"|"cat-entertainment"|"cat-shopping"|"cat-other"}
- shopping: {"type":"shopping","name":"..."}
- note: {"type":"note","content":"..."}

Understanding rules (IMPORTANT):
- SPEECH CORRUPTION PATTERNS (fix these):
  D00000/D0000/d00 → 200, 2000 (browser turns "do sau" into D + zeros)
  O00/Oo0 → 100 (browser turns "ek sau" into O + zeros)
  T00/T000 → 300, 3000 ("teen sau")
  P00/P500 → 500 ("paanch sau")
  "sabhi" → "sabji/sabzi" (vegetables)
  "online" → "mangayi/mangaya/order" (ordered)
  "mane" → "maine" (I did)
  Any text with a garbled number pattern near food/purchase words = expense
- Fix speech errors and bad pronunciation — map sounds to intent, not literal spelling:
  doodh/dud/dudh/dood/milk → "Order milk"
  sabzi/sabjee/savvy/sabji/sabhi/veggie/vegetable → vegetables
  anda/anday/egg → eggs
  bill/bijli/bijlee/electric → pay electricity bill
  pani/paani/water → drink water
  dawa/dawai/medicine → medicine
  kapde/kapda/laundry → laundry
  subah/subah ka/morning → morning routine
  mangayi/mangaya/manga/order/online → ordered (expense context)
  kharcha/kharch/spent/rupaye/rs/paise → expense
- "2 task" / "do task" / "dono" / "pehla doosra" / numbered list → split into separate task actions.
- remind / yaad / yaad dilana / reminder → remind:true on tasks OR add reminder actions.
- kal → tomorrow, parso → day after tomorrow, aaj → today (use context.today and context.selectedDate).
- Default dueDate = context.selectedDate unless user gives another date.
- Short clear English or Hindi titles (e.g. "Doodh mangwana", "Order milk", "Pay electricity bill").
- If user clearly wants shopping (kharidna, lana, buy, shopping list) use shopping type.
- If amount + purchase/food/money context → use expense. ALWAYS try to extract a sensible amount.
- When intent is unclear but sounds like a todo → create a task rather than returning empty.
- Ignore filler: please, kripya, ok, um, matlab, basically, rozka, add karo, bana do.
- NEVER return empty actions array if there's any recognizable intent in the input.

Examples:
Input: "aaj mane D00000 sabhi online" (garbled: "aaj maine 200 ki online sabji mangayi")
→ expense 200, cat-groceries, description "Online sabji order"

Input: "please create 2 task order milk and order veggie also remind me"
→ two tasks with remind:true

Input: "doodh aur sabzi ka order karo yaad dilana"
→ tasks: Order milk + Order sabzi, both remind:true

Input: "50 rupaye chai par kharch"
→ expense 50, cat-dining, description chai

Input: "P500 petrol dala" (garbled: "500 rupaye petrol dala")
→ expense 500, cat-transport, description "Petrol"

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

const LIFE_COACH_PROMPT = `You are Rozka AI — a warm, practical life coach for Indian users (Hindi or English).

You receive a snapshot of the user's real data: tasks done/total, overdue count, dreams/goals, routines, shopping, expenses.

Return ONLY valid JSON (no markdown):
{
  "lesson": "one short life lesson based on their data (max 2 sentences, practical not preachy)",
  "futureStep": "one concrete step toward their dreams this week",
  "encouragement": "one warm line — use their first name if snapshot.userName is provided",
  "suggestedTasks": [{"title":"short task","area":"PERSONAL"|"WORK"|"HOME"}]
}

Rules:
- Base advice ONLY on snapshot data provided — do not invent facts
- If dreams array is non-empty, connect futureStep to a dream
- If overdueCount > 0, lesson should gently address finishing old tasks
- If tasksDone equals tasksTotal and total > 0, celebrate consistency
- suggestedTasks: 0–3 items max, due today, short titles
- Use Hindi if lang is hi-IN, English if en-US
- Kind, simple words — like a wise friend, not a lecture`;

const CALENDAR_PLAN_PROMPT = `You are Rozka AI calendar planner for Indian users (Hindi or English).

You receive existing calendar events for one week (tasks, reminders, expenses, notes).

Return ONLY valid JSON (no markdown):
{
  "summary": "one friendly line about the week plan",
  "actions": [...]
}

Each action uses the same types as voice commands:
- task: {"type":"task","title":"...","area":"PERSONAL"|"WORK"|"HOME","dueDate":"YYYY-MM-DD","remind":true|false}
- reminder: {"type":"reminder","title":"...","dueDate":"YYYY-MM-DD","repeat":"NONE"|"MONTHLY"|"YEARLY"}
- shopping: {"type":"shopping","name":"..."}

Rules:
- Spread new work across context.from to context.to — do not pile everything on one day
- Respect existing events — avoid duplicate titles on same day
- Add 3–8 helpful actions for the week (tasks, reminders, shopping)
- Include bills/birthdays from existing reminder events if any
- Use Hindi titles if lang is hi-IN
- dueDate must fall within the week range`;

const DECISION_ENGINE_PROMPT = `You are Rozka AI Decision Engine — help Indian users make smart life decisions based on their real financial and goal data.

User asks: "Should I buy/do X?" and you analyze their actual situation.

Return ONLY valid JSON (no markdown):
{
  "verdict": "YES" | "NO" | "WAIT" | "MAYBE",
  "confidence": 0-100,
  "reasoning": "2-3 sentences explaining why, with specific numbers from their data",
  "impact": {
    "savings_delay_days": number or 0,
    "goal_affected": "which dream/goal is impacted" or null,
    "budget_status": "how much % of monthly budget remains after this",
    "opportunity_cost": "what else could this money do"
  },
  "alternatives": ["cheaper/better alternative 1", "alternative 2"],
  "ai_advice": "1-2 sentences of personal advice like a wise financial friend"
}

Rules:
- Use REAL numbers from context.expenses, context.savings, context.goals
- If monthly spending already > 80% of last month → lean toward NO/WAIT
- If purchase delays a major dream/goal → calculate exact days of delay
- If it's a need (medicine, food, bills) → usually YES
- If it's a want (gadgets, clothes, entertainment) → check budget health first
- alternatives: suggest 2 cheaper or better options
- Be honest and specific: "This ₹15,000 phone delays your house goal by 23 days"
- Use Hindi if lang is hi-IN, English if en-US
- Never be preachy — be a smart friend, not a financial advisor`;

const LIFE_GPS_PROMPT = `You are Rozka AI Life GPS — show users where their life is heading based on current patterns.

CRITICAL: ZERO HALLUCINATION POLICY
- ONLY analyze data actually provided in context (tasks, expenses, routines, dreams).
- NEVER invent activities, people, habits, or numbers not in the data.
- If an area has no data, set arrow to "flat", momentum to 5, and trend to "Not enough data yet."
- Every prediction must be based on REAL numbers from the context.

Analyze their tasks, expenses, routines, and habits data to determine life direction in each area.

Return ONLY valid JSON (no markdown):
{
  "directions": {
    "financial": {"arrow": "up" | "down" | "flat", "momentum": 1-10, "trend": "short description"},
    "health": {"arrow": "up" | "down" | "flat", "momentum": 1-10, "trend": "short description"},
    "career": {"arrow": "up" | "down" | "flat", "momentum": 1-10, "trend": "short description"},
    "relationships": {"arrow": "up" | "down" | "flat", "momentum": 1-10, "trend": "short description"},
    "learning": {"arrow": "up" | "down" | "flat", "momentum": 1-10, "trend": "short description"},
    "discipline": {"arrow": "up" | "down" | "flat", "momentum": 1-10, "trend": "short description"}
  },
  "twelve_month_prediction": {
    "financial": "Where they'll be financially in 12 months at this rate",
    "health": "Health prediction",
    "career": "Career prediction",
    "overall": "Overall life trajectory summary"
  },
  "course_corrections": ["specific action to change direction 1", "action 2", "action 3"],
  "speed": "ACCELERATING" | "CRUISING" | "SLOWING" | "STALLED",
  "life_direction_summary": "One powerful sentence about their current life direction",
  "warning": "Most critical thing that needs attention NOW" or null
}

Rules:
- arrow: up = improving, down = declining, flat = no change
- momentum: 1 = barely moving, 10 = strong momentum
- Base EVERYTHING on actual data — completed tasks, expenses, routines done, missed items
- twelve_month_prediction: Be specific with numbers ("At this saving rate, you'll have ₹X by next year")
- course_corrections: 3 most impactful changes they could make TODAY
- speed: overall life progress speed
- warning: Only if something is critically declining
- Use Hindi if lang is hi-IN
- Be brutally honest but constructive`;

const LIFE_REPLAY_PROMPT = `You are Rozka AI Life Replay — generate a cinematic monthly recap of the user's life.

Like a year-in-review but for one month. Make it feel powerful and shareable.

Return ONLY valid JSON (no markdown):
{
  "month_title": "Creative title for this month (e.g., 'The Month You Took Control')",
  "headline_stat": {"value": "143", "label": "tasks completed", "emoji": "✅"},
  "stats": [
    {"value": "string", "label": "string", "emoji": "string", "sentiment": "good" | "neutral" | "bad"}
  ],
  "highlights": ["Best thing that happened 1", "highlight 2", "highlight 3"],
  "lowlights": ["Thing that didn't go well 1", "lowlight 2"],
  "money_story": "One sentence about their spending this month with specific numbers",
  "productivity_story": "One sentence about task completion with numbers",
  "habit_streak": "Longest routine streak or best habit this month",
  "ai_letter": "3-4 sentences personal letter from AI about this month — honest, warm, motivational",
  "next_month_focus": "The ONE thing to focus on next month for maximum life improvement",
  "share_text": "A short tweet-like summary perfect for sharing (under 100 chars)"
}

Rules:
- stats: Include 4-6 key stats (tasks done, money spent, money saved, routines completed, days active, etc.)
- highlights: Real achievements from data (big tasks completed, savings milestones, streaks)
- lowlights: Be honest about what went wrong (missed routines, overspending categories)
- money_story: Use real expense numbers from data
- ai_letter: Write like a friend summarizing their month. Personal. Specific.
- share_text: Something they'd want to post on social media
- Use Hindi if lang is hi-IN
- Make it FEEL like a movie recap — dramatic, personal, celebratory where earned`;

const LIFE_AUTOPILOT_PROMPT = `You are Rozka AI Life Autopilot — a personal chief of staff for Indian users.

You generate a smart morning briefing based STRICTLY on the user's REAL data provided in the context.

CRITICAL RULE — ZERO HALLUCINATION:
- You MUST ONLY reference tasks, expenses, people, habits, and activities that ACTUALLY EXIST in the provided context data.
- NEVER invent people names (no "Rahul", "Rohan", etc.) unless they appear in context.staleMemories or context.missedTasks.
- NEVER suggest activities the user doesn't already do (no "practice piano", "go to gym") unless their tasks/routines contain them.
- NEVER make up expense amounts or spending patterns not in the data.
- If context has empty arrays or zero values, give ONLY generic time-management advice — do NOT fill in fake specifics.
- If you cannot determine something from the data, set that field to null or empty array.

Return ONLY valid JSON (no markdown):
{
  "doToday": ["action1", "action2", "action3"],
  "dontToday": ["avoid1", "avoid2"],
  "spendingWarning": "specific warning based on REAL expense data, or null",
  "healthWarning": "based on REAL routine data showing missed items, or null",
  "relationshipReminder": null,
  "highImpactTask": "from user's ACTUAL pending tasks only, or null",
  "regretAlerts": [{"task":"ACTUAL task title from data","postponeCount":N,"daysSinceCreated":N,"warning":"warning about THIS specific task"}],
  "aiMessage": "2-3 sentences based on their REAL progress today"
}

Rules:
- doToday: ONLY suggest things based on actual pending tasks, routines, or shopping items from context. MAX 5. If data is sparse, suggest 2-3 generic ones like "Plan your day" or "Review pending tasks."
- dontToday: ONLY based on real expense patterns. If no expense data, set to empty array [].
- spendingWarning: ONLY if context shows expensesThisMonth > expensesLastMonth. Use REAL numbers from context. If no data → null.
- healthWarning: ONLY if context.routinesPending > 0. Otherwise null.
- relationshipReminder: ONLY if context.staleMemories contains a person's name. Otherwise MUST be null.
- highImpactTask: Must be an ACTUAL task from context.missedTasks or context data. If none, null.
- regretAlerts: ONLY from context.postponedTasks array. Each task title must EXACTLY match one from the data. If empty, return [].
- aiMessage: Refer only to real numbers (tasksToday, tasksDone, overdue count).
- Use Hindi if lang is hi-IN, English if en-US.
- WHEN IN DOUBT, LEAVE IT NULL OR EMPTY. Never invent data.`;

const DREAM_PLAN_PROMPT = `You are Rozka AI — an AI Chief of Staff that creates automatic action plans when users declare a dream or goal.

Given a dream/goal title and category, generate a COMPLETE actionable plan.

Return ONLY valid JSON (no markdown):
{
  "summary": "1-2 sentence rewrite of the goal with clarity and timeline",
  "monthlyTargets": [
    {"month": 1, "target": "specific measurable target", "tasks": ["task1","task2","task3"]},
    {"month": 2, "target": "...", "tasks": ["..."]},
    {"month": 3, "target": "...", "tasks": ["..."]}
  ],
  "weeklyHabits": ["habit1 to do daily/weekly", "habit2", "habit3"],
  "budgetImpact": "how this affects money — savings needed, cuts required, or 'no cost'",
  "risks": ["risk1 that could derail this", "risk2"],
  "successProbability": 75,
  "firstStepToday": "the ONE thing to do TODAY to start this dream"
}

Rules:
- monthlyTargets: Create exactly 3-6 months of targets. Each month has 3-5 specific tasks.
- Tasks should be small, actionable, achievable in 1-2 hours each.
- weeklyHabits: 3-5 habits that support this dream long-term.
- budgetImpact: Be specific with numbers if financial goal (e.g., "Save ₹15,000/month").
- risks: Honest about what could go wrong.
- successProbability: Realistic 0-100 score based on typical achievement rates.
- firstStepToday: Ultra-specific, can be done in 15 minutes.
- Use Hindi if lang is hi-IN, English if en-US.
- Make it feel like a CEO created this plan for their most important project.`;

const LIFE_DASHBOARD_PROMPT = `You are Rozka AI — a personal life operating system and coach for Indian users.

CRITICAL: ZERO HALLUCINATION POLICY
- You MUST ONLY reference data that actually exists in the provided context.
- NEVER invent people names, activities, habits, or numbers not in the data.
- If data is empty or missing, score that area as 50 (neutral) and say "not enough data."
- Every claim must be traceable to a specific number or item in the context.

You receive COMPREHENSIVE life data including:
- Tasks: today's count, this week, this month, LAST MONTH (done vs total), overdue, missed task titles
- Expenses: today, this month, LAST MONTH, top categories both months, 7-day total, month-over-month trend
- Routines: names with done/total
- Dreams/Goals: titles from vision board
- Task completion rate over 7 days
- Shopping pending count

Analyze EVERYTHING deeply and return ONLY valid JSON (no markdown):
{
  "life_score": 0-100,
  "productivity_score": 0-100,
  "financial_score": 0-100,
  "health_score": 0-100,
  "consistency_score": 0-100,
  "top_strengths": ["strength1", "strength2", "strength3"],
  "top_weaknesses": ["weakness1", "weakness2", "weakness3"],
  "hidden_patterns": ["pattern1", "pattern2", "pattern3"],
  "future_predictions": ["if you continue this... prediction1", "prediction2", "prediction3"],
  "goal_progress": [{"goal": "dream title", "progress_pct": 0-100, "next_step": "specific action"}],
  "life_loopholes": [{"problem": "...", "evidence": "data-backed reason", "fix": "specific actionable fix", "priority": "high"|"medium"|"low"}],
  "spending_insight": "compare this month vs last month, highlight biggest category, warning if overspending",
  "weekly_wins": ["win1", "win2"],
  "weekly_misses": ["miss1", "miss2"],
  "recommended_actions": [{"type":"task","title":"...","area":"PERSONAL"|"WORK"|"HOME"}],
  "ai_coach_message": "3-4 sentences: what's working, what's not, what to do next. Be honest and specific.",
  "morning_briefing": "today's priority focus based on overdue + habits + goals"
}

SCORING RULES (be strict, not generous):
- productivity_score: task completion rate × consistency. <50% done = score below 40. All done = 80+. Factor in overdue.
- financial_score: 80 if spending stable/decreasing. -10 for each unnecessary category spike. -20 if month-over-month increase >30%.
- health_score: based on routine completion. No routines = 30. All done = 85+. Missing morning = -15.
- consistency_score: based on 7-day task rate + routine regularity. <30% = below 30. >80% = above 75.
- life_score: weighted avg (productivity 30%, financial 25%, health 20%, consistency 25%)

PATTERN DETECTION (use actual data):
- Compare this month vs last month expenses — flag increases
- Check task completion rate — flag if declining
- Look at missed tasks — find recurring themes (procrastination areas)
- Check routine gaps — find which habits are breaking

FUTURE PREDICTIONS (be specific with numbers):
- "If you keep spending ₹X/month on [category], you'll spend ₹Y this year"
- "At current task completion rate of X%, you'll finish Y of Z goals"
- "Your [routine] consistency suggests [health outcome]"

LIFE LOOPHOLES (be brutally honest):
- Must include EVIDENCE from the data
- Must include specific FIX (not vague advice)
- Priority based on impact

Use Hindi if lang is hi-IN, English if en-US. Be a wise friend — honest, practical, data-driven.`;

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

function sanitizeSuggestedTasks(raw, dueDate) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const title = String(item.title || '').trim();
    if (title.length < 2) continue;
    out.push({
      type: 'task',
      title,
      area: VALID_AREAS.has(item.area) ? item.area : 'PERSONAL',
      dueDate,
    });
  }
  return out.slice(0, 3);
}

function sanitizeLifeCoach(raw, dueDate) {
  return {
    lesson: String(raw.lesson || '').trim().slice(0, 600),
    futureStep: String(raw.futureStep || '').trim().slice(0, 400),
    encouragement: String(raw.encouragement || '').trim().slice(0, 300),
    suggestedTasks: sanitizeSuggestedTasks(raw.suggestedTasks, dueDate),
  };
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

async function invokeLifeCoach(client, modelId, lang, context) {
  const userPayload = JSON.stringify({ mode: 'life_coach', lang, context });
  const command = new ConverseCommand({
    modelId,
    system: [{ text: LIFE_COACH_PROMPT }],
    messages: [{ role: 'user', content: [{ text: userPayload }] }],
    inferenceConfig: { maxTokens: 900, temperature: 0.35 },
  });
  const result = await client.send(command);
  const text = result.output?.message?.content?.map((c) => c.text).filter(Boolean).join('') || '';
  const parsed = extractJson(text);
  return sanitizeLifeCoach(parsed, context.today || context.selectedDate);
}

async function invokeCalendarPlan(client, modelId, lang, context) {
  const userPayload = JSON.stringify({ mode: 'calendar_plan', lang, context });
  const command = new ConverseCommand({
    modelId,
    system: [{ text: CALENDAR_PLAN_PROMPT }],
    messages: [{ role: 'user', content: [{ text: userPayload }] }],
    inferenceConfig: { maxTokens: 1400, temperature: 0.25 },
  });
  const result = await client.send(command);
  const text = result.output?.message?.content?.map((c) => c.text).filter(Boolean).join('') || '';
  const parsed = extractJson(text);
  const dueDefault = context.from || context.today;
  return {
    summary: String(parsed.summary || '').trim().slice(0, 400),
    actions: sanitizeActions(parsed.actions, dueDefault),
  };
}

async function invokeLifeDashboard(client, modelId, lang, context) {
  const userPayload = JSON.stringify({ mode: 'life_dashboard', lang, context });
  const command = new ConverseCommand({
    modelId,
    system: [{ text: LIFE_DASHBOARD_PROMPT }],
    messages: [{ role: 'user', content: [{ text: userPayload }] }],
    inferenceConfig: { maxTokens: 2500, temperature: 0.3 },
  });
  const result = await client.send(command);
  const text = result.output?.message?.content?.map((c) => c.text).filter(Boolean).join('') || '';
  const parsed = extractJson(text);
  return sanitizeLifeDashboard(parsed, context.today || context.selectedDate);
}

function sanitizeLifeDashboard(raw, dueDate) {
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  const strArr = (arr, max = 3) =>
    (Array.isArray(arr) ? arr : []).map((s) => String(s).trim()).filter(Boolean).slice(0, max);
  return {
    life_score: clamp(raw.life_score),
    productivity_score: clamp(raw.productivity_score),
    financial_score: clamp(raw.financial_score),
    health_score: clamp(raw.health_score),
    consistency_score: clamp(raw.consistency_score),
    top_strengths: strArr(raw.top_strengths),
    top_weaknesses: strArr(raw.top_weaknesses),
    hidden_patterns: strArr(raw.hidden_patterns),
    future_predictions: strArr(raw.future_predictions),
    goal_progress: (Array.isArray(raw.goal_progress) ? raw.goal_progress : []).slice(0, 5).map((g) => ({
      goal: String(g?.goal || '').trim(),
      progress_pct: clamp(g?.progress_pct),
      next_step: String(g?.next_step || '').trim(),
    })),
    life_loopholes: (Array.isArray(raw.life_loopholes) ? raw.life_loopholes : []).slice(0, 4).map((l) => ({
      problem: String(l?.problem || '').trim(),
      evidence: String(l?.evidence || '').trim(),
      fix: String(l?.fix || '').trim(),
      priority: ['high', 'medium', 'low'].includes(l?.priority) ? l.priority : 'medium',
    })),
    spending_insight: String(raw.spending_insight || '').trim().slice(0, 200),
    weekly_wins: strArr(raw.weekly_wins),
    weekly_misses: strArr(raw.weekly_misses),
    recommended_actions: sanitizeSuggestedTasks(raw.recommended_actions, dueDate),
    ai_coach_message: String(raw.ai_coach_message || '').trim().slice(0, 500),
    morning_briefing: String(raw.morning_briefing || '').trim().slice(0, 300),
  };
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

async function parseLifeCoach(lang, context) {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const client = new BedrockRuntimeClient({ region });
  let lastError = null;

  for (const modelId of MODEL_IDS) {
    try {
      const coach = await invokeLifeCoach(client, modelId, lang, context);
      if (!coach.lesson) throw new Error('Empty life coach response');
      return { coach, model: modelId };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Life coach failed');
}

async function parseCalendarPlan(lang, context) {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const client = new BedrockRuntimeClient({ region });
  let lastError = null;

  for (const modelId of MODEL_IDS) {
    try {
      const plan = await invokeCalendarPlan(client, modelId, lang, context);
      if (!plan.summary && plan.actions.length === 0) throw new Error('Empty calendar plan');
      return { plan, model: modelId };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Calendar plan failed');
}

async function parseLifeDashboard(lang, context) {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const client = new BedrockRuntimeClient({ region });
  let lastError = null;

  for (const modelId of MODEL_IDS) {
    try {
      const dashboard = await invokeLifeDashboard(client, modelId, lang, context);
      if (!dashboard.ai_coach_message && dashboard.life_score === 0) throw new Error('Empty dashboard');
      return { dashboard, model: modelId };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Life dashboard failed');
}

async function invokeLifeAutopilot(client, modelId, lang, context) {
  const userPayload = JSON.stringify({ mode: 'life_autopilot', lang, context });
  const command = new ConverseCommand({
    modelId,
    system: [{ text: LIFE_AUTOPILOT_PROMPT }],
    messages: [{ role: 'user', content: [{ text: userPayload }] }],
    inferenceConfig: { maxTokens: 1500, temperature: 0.3 },
  });
  const result = await client.send(command);
  const text = result.output?.message?.content?.map((c) => c.text).filter(Boolean).join('') || '';
  const parsed = extractJson(text);
  return sanitizeAutopilot(parsed);
}

function sanitizeAutopilot(raw) {
  const strArr = (arr, max = 5) =>
    (Array.isArray(arr) ? arr : []).map((s) => String(s).trim()).filter(Boolean).slice(0, max);
  return {
    doToday: strArr(raw.doToday, 5),
    dontToday: strArr(raw.dontToday, 3),
    spendingWarning: raw.spendingWarning ? String(raw.spendingWarning).trim().slice(0, 200) : null,
    healthWarning: raw.healthWarning ? String(raw.healthWarning).trim().slice(0, 200) : null,
    relationshipReminder: raw.relationshipReminder ? String(raw.relationshipReminder).trim().slice(0, 200) : null,
    highImpactTask: raw.highImpactTask ? String(raw.highImpactTask).trim().slice(0, 150) : null,
    regretAlerts: (Array.isArray(raw.regretAlerts) ? raw.regretAlerts : []).slice(0, 3).map((r) => ({
      task: String(r?.task || '').trim(),
      postponeCount: Number(r?.postponeCount) || 0,
      daysSinceCreated: Number(r?.daysSinceCreated) || 0,
      warning: String(r?.warning || '').trim().slice(0, 200),
    })),
    aiMessage: String(raw.aiMessage || '').trim().slice(0, 400),
  };
}

async function parseLifeAutopilot(lang, context) {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const client = new BedrockRuntimeClient({ region });
  let lastError = null;

  for (const modelId of MODEL_IDS) {
    try {
      const autopilot = await invokeLifeAutopilot(client, modelId, lang, context);
      if (!autopilot.aiMessage && autopilot.doToday.length === 0) throw new Error('Empty autopilot');
      return { autopilot, model: modelId };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Life autopilot failed');
}

async function invokeDreamPlan(client, modelId, lang, context) {
  const userPayload = JSON.stringify({ mode: 'dream_plan', lang, context });
  const command = new ConverseCommand({
    modelId,
    system: [{ text: DREAM_PLAN_PROMPT }],
    messages: [{ role: 'user', content: [{ text: userPayload }] }],
    inferenceConfig: { maxTokens: 2000, temperature: 0.4 },
  });
  const result = await client.send(command);
  const text = result.output?.message?.content?.map((c) => c.text).filter(Boolean).join('') || '';
  const parsed = extractJson(text);
  return sanitizeDreamPlan(parsed);
}

function sanitizeDreamPlan(raw) {
  const strArr = (arr, max = 10) =>
    (Array.isArray(arr) ? arr : []).map((s) => String(s).trim()).filter(Boolean).slice(0, max);
  return {
    summary: String(raw.summary || '').trim().slice(0, 300),
    monthlyTargets: (Array.isArray(raw.monthlyTargets) ? raw.monthlyTargets : []).slice(0, 6).map((m) => ({
      month: Number(m?.month) || 1,
      target: String(m?.target || '').trim().slice(0, 200),
      tasks: strArr(m?.tasks, 5),
    })),
    weeklyHabits: strArr(raw.weeklyHabits, 5),
    budgetImpact: String(raw.budgetImpact || '').trim().slice(0, 200),
    risks: strArr(raw.risks, 4),
    successProbability: Math.min(100, Math.max(0, Number(raw.successProbability) || 50)),
    firstStepToday: String(raw.firstStepToday || '').trim().slice(0, 200),
  };
}

async function parseDreamPlan(lang, context) {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const client = new BedrockRuntimeClient({ region });
  let lastError = null;

  for (const modelId of MODEL_IDS) {
    try {
      const plan = await invokeDreamPlan(client, modelId, lang, context);
      if (!plan.summary && plan.monthlyTargets.length === 0) throw new Error('Empty dream plan');
      return { plan, model: modelId };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Dream plan failed');
}

async function invokeGenericAI(client, modelId, systemPrompt, context, maxTokens = 1500) {
  const userPayload = JSON.stringify(context);
  const command = new ConverseCommand({
    modelId,
    system: [{ text: systemPrompt }],
    messages: [{ role: 'user', content: [{ text: userPayload }] }],
    inferenceConfig: { maxTokens, temperature: 0.3 },
  });
  const result = await client.send(command);
  const text = result.output?.message?.content?.map((c) => c.text).filter(Boolean).join('') || '';
  return extractJson(text);
}

async function parseWithPrompt(promptText, lang, context, maxTokens = 1500) {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const client = new BedrockRuntimeClient({ region });
  let lastError = null;

  for (const modelId of MODEL_IDS) {
    try {
      const result = await invokeGenericAI(client, modelId, promptText, { mode: 'ai', lang, context }, maxTokens);
      if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) throw new Error('Empty result');
      return { result, model: modelId };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('AI analysis failed');
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
  const snapshot = payload.context?.snapshot && typeof payload.context.snapshot === 'object'
    ? payload.context.snapshot
    : {};
  const from = typeof payload.context?.from === 'string' ? payload.context.from : today;
  const to = typeof payload.context?.to === 'string' ? payload.context.to : from;
  const events = Array.isArray(payload.context?.events) ? payload.context.events : [];
  const context = { today, selectedDate, lang, routines, snapshot, from, to, events };

  if (payload.mode === 'calendar_plan') {
    try {
      const { plan, model } = await parseCalendarPlan(lang, context);
      return response(200, {
        ok: true,
        summary: plan.summary,
        actions: plan.actions,
        model,
      });
    } catch (err) {
      const message = err?.message || 'Calendar plan failed';
      return response(500, { ok: false, error: message });
    }
  }

  if (payload.mode === 'life_dashboard') {
    try {
      const { dashboard, model } = await parseLifeDashboard(lang, context);
      return response(200, { ok: true, ...dashboard, model });
    } catch (err) {
      const message = err?.message || 'Life dashboard failed';
      return response(500, { ok: false, error: message });
    }
  }

  if (payload.mode === 'life_autopilot') {
    try {
      const { autopilot, model } = await parseLifeAutopilot(lang, context);
      return response(200, { ok: true, ...autopilot, model });
    } catch (err) {
      const message = err?.message || 'Life autopilot failed';
      return response(500, { ok: false, error: message });
    }
  }

  if (payload.mode === 'dream_plan') {
    try {
      const { plan, model } = await parseDreamPlan(lang, context);
      return response(200, { ok: true, ...plan, model });
    } catch (err) {
      const message = err?.message || 'Dream plan failed';
      return response(500, { ok: false, error: message });
    }
  }

  if (payload.mode === 'decision_engine') {
    try {
      const { result, model } = await parseWithPrompt(DECISION_ENGINE_PROMPT, lang, context, 1500);
      return response(200, { ok: true, ...result, model });
    } catch (err) {
      return response(500, { ok: false, error: err?.message || 'Decision engine failed' });
    }
  }

  if (payload.mode === 'life_gps') {
    try {
      const { result, model } = await parseWithPrompt(LIFE_GPS_PROMPT, lang, context, 2000);
      return response(200, { ok: true, ...result, model });
    } catch (err) {
      return response(500, { ok: false, error: err?.message || 'Life GPS failed' });
    }
  }

  if (payload.mode === 'life_replay') {
    try {
      const { result, model } = await parseWithPrompt(LIFE_REPLAY_PROMPT, lang, context, 2000);
      return response(200, { ok: true, ...result, model });
    } catch (err) {
      return response(500, { ok: false, error: err?.message || 'Life replay failed' });
    }
  }

  if (payload.mode === 'life_coach') {
    try {
      const { coach, model } = await parseLifeCoach(lang, context);
      return response(200, {
        ok: true,
        lesson: coach.lesson,
        futureStep: coach.futureStep,
        encouragement: coach.encouragement,
        suggestedTasks: coach.suggestedTasks,
        model,
      });
    } catch (err) {
      const message = err?.message || 'Life coach failed';
      return response(500, { ok: false, error: message });
    }
  }

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
