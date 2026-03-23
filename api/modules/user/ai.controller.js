import axios from 'axios';
import pool from '../../config/db.js';
import { isNonEmptyString, isValidAIMode, sanitizeString, validationError, parsePagination } from '../../shared/validators/index.js';
import { MESSAGES } from '../../shared/constants/messages.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const LLAMA_URL        = process.env.LLAMA_URL || 'http://127.0.0.1:8080';
const GENERAL_TIMEOUT  = 50000;
const ADVANCED_TIMEOUT = 90000;
const INSIGHTS_TIMEOUT = 90000;
const MAX_HISTORY      = 6;
const CACHE_TTL        = 300000;  // 5 minutes

// ─── In-memory session stores ────────────────────────────────────────────────

const conversations = new Map();
const lastResponses = new Map();
const sessionMemory = new Map();
const responseCache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of conversations.entries()) {
    if (now - data.lastAccess > CACHE_TTL) {
      conversations.delete(userId);
      lastResponses.delete(userId);
      sessionMemory.delete(userId);
    }
  }
  for (const [key, cached] of responseCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL) responseCache.delete(key);
  }
}, 600000);

// ─── User financial context ───────────────────────────────────────────────────

async function getUserContext(userId) {
  try {
    const result = await pool.query(`
      WITH month_data AS (
        SELECT
          COALESCE(SUM(amount), 0) AS spent,
          COUNT(*) AS tx_count
        FROM transactions
        WHERE user_id = $1
          AND transaction_type = 'expense'
          AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
      ),
      last_month AS (
        SELECT COALESCE(SUM(amount), 0) AS last_spent
        FROM transactions
        WHERE user_id = $1 AND transaction_type = 'expense'
          AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      ),
      top_cat AS (
        SELECT category, SUM(amount) AS amount
        FROM transactions
        WHERE user_id = $1
          AND transaction_type = 'expense'
          AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY category ORDER BY amount DESC LIMIT 1
      ),
      goals_data AS (
        SELECT COUNT(*) AS total_goals,
               COALESCE(SUM(target_amount),  0) AS target,
               COALESCE(SUM(current_amount), 0) AS saved
        FROM savings_goals WHERE user_id = $1 AND status != 'completed'
      )
      SELECT m.spent, m.tx_count, l.last_spent,
             t.category AS top_cat, t.amount AS top_amount,
             g.total_goals, g.target AS goals_target, g.saved AS goals_saved,
             (SELECT monthly_income FROM user_profiles WHERE user_id = $1) AS budget
      FROM month_data m CROSS JOIN last_month l
      LEFT  JOIN top_cat     t ON true
      CROSS JOIN goals_data  g
    `, [userId]);

    const d      = result.rows[0];
    const remain = (parseFloat(d.budget) || 0) - (parseFloat(d.spent) || 0);
    const lastChange = d.last_spent > 0
      ? (((d.spent - d.last_spent) / d.last_spent) * 100).toFixed(0) : 0;

    return {
      budget:        parseFloat(d.budget      || 0),
      spent:         parseFloat(d.spent       || 0),
      remaining:     remain,
      percentage:    d.budget > 0 ? ((d.spent / d.budget) * 100).toFixed(0) : 0,
      txCount:       parseInt(d.tx_count      || 0, 10),
      topCategory:   d.top_cat               || null,
      topAmount:     parseFloat(d.top_amount  || 0),
      lastMonthSpent: parseFloat(d.last_spent || 0),
      vsLastMonth:   lastChange,
      goalsCount:    parseInt(d.total_goals   || 0, 10),
      goalsTarget:   parseFloat(d.goals_target || 0),
      goalsSaved:    parseFloat(d.goals_saved  || 0),
    };
  } catch (err) {
    console.error('[AI] getUserContext error:', err.message);
    return { budget: 0, spent: 0, remaining: 0, percentage: 0, txCount: 0 };
  }
}

// ─── Entity / reference helpers ───────────────────────────────────────────────

function extractEntities(text) {
  const entities = { amounts: [], categories: [], percentages: [] };
  const amountMatches = text.match(/₱?[\d,]+/g);
  if (amountMatches) entities.amounts = amountMatches.map((m) => m.replace(/[₱,]/g, ''));
  const knownCategories = ['food', 'transportation', 'shopping', 'bills', 'entertainment', 'health', 'groceries', 'savings'];
  knownCategories.forEach((cat) => { if (text.toLowerCase().includes(cat)) entities.categories.push(cat); });
  const pctMatches = text.match(/\d+%/g);
  if (pctMatches) entities.percentages = pctMatches;
  return entities;
}

function resolveReferences(message, userId) {
  const last = lastResponses.get(userId);
  if (!last || Date.now() - last.timestamp > CACHE_TTL) return message;
  let resolved = message;
  if (/\b(that|it|this)\b/i.test(message) && last.entities.amounts.length > 0) {
    resolved = resolved
      .replace(/\bthat\b/gi, `₱${last.entities.amounts[0]}`)
      .replace(/\bit\b/gi,   `₱${last.entities.amounts[0]}`)
      .replace(/\bthis\b/gi, `₱${last.entities.amounts[0]}`);
  }
  if (/\b(them|those)\b/i.test(message) && last.entities.categories.length > 0) {
    const catStr = last.entities.categories.join(' and ');
    resolved = resolved.replace(/\bthem\b/gi, catStr).replace(/\bthose\b/gi, catStr);
  }
  return resolved;
}

function detectTopic(message, context) {
  const msg = message.toLowerCase();
  if (msg.includes('spend') || msg.includes('spent') || msg.includes('expense'))
    return { topic: 'spending', data: `spending ₱${Math.round(context.spent)}` };
  if (msg.includes('budget') || msg.includes('afford') || msg.includes('remaining') || msg.includes('left'))
    return { topic: 'budget', data: `budget ₱${Math.round(context.budget)}, remaining ₱${Math.round(context.remaining)}` };
  if (msg.includes('save') || msg.includes('saving') || msg.includes('goal'))
    return { topic: 'savings', data: `${context.goalsCount} goals, ₱${Math.round(context.goalsSaved)} saved` };
  if (msg.includes('last month') || msg.includes('previous') || msg.includes('compare'))
    return { topic: 'comparison', data: `vs last month ${context.vsLastMonth > 0 ? '+' : ''}${context.vsLastMonth}%` };
  if (context.topCategory && msg.includes(context.topCategory.toLowerCase()))
    return { topic: 'category', data: `${context.topCategory} spending ₱${Math.round(context.topAmount)}` };
  return { topic: 'general', data: '' };
}

function enrichFollowUp(message, userId, context) {
  const session = sessionMemory.get(userId);
  const isFollowUp = /^(what about|how about|is that|is it|and|also|what if|why|should i)\b/i.test(message.trim());
  if (isFollowUp && session && Date.now() - session.timestamp < 180000) {
    return `Regarding ${session.data}, ${message}`;
  }
  return message;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildOptimizedPrompt(message, context, mode) {
  let systemMsg, maxTokens;

  if (mode === 'general') {
    maxTokens = 220;
    systemMsg = `You are PESO AI, a helpful personal finance advisor. Give clear, concise advice in 4-5 complete sentences.

CRITICAL FORMATTING RULES:
- Write naturally, like texting a knowledgeable friend
- NO emojis, NO hashtags, NO numbering (1/3, 2/3, etc.)
- NO section headers or labels
- Use simple line breaks between sentences
- Always reference their actual numbers when relevant
- Be direct, specific, and actionable
- ALWAYS write complete sentences with proper punctuation
- NEVER use brackets [] or incomplete words

When mentioning amounts:
- Write currency clearly: "₱50,000" not "[₱50,00"
- Complete all words and numbers fully`;
  } else {
    maxTokens = 400;
    systemMsg = `You are PESO AI, a knowledgeable personal finance advisor. Provide comprehensive, actionable guidance using their actual financial data.

CRITICAL FORMATTING RULES:
- Write in natural, conversational paragraphs
- NO emojis, NO hashtags, NO numbering systems
- NO section headers like "Opening:", "Analysis:", "Action:"
- Use blank lines between paragraphs
- Reference their specific numbers, amounts, and percentages
- Provide detailed, practical recommendations
- Keep under 250 words
- ALWAYS write complete sentences with proper punctuation
- NEVER truncate words or use brackets []

Response Structure (natural paragraphs, not labeled):
First paragraph:  Acknowledge their current situation with specific numbers
Second paragraph: Analyse what's happening and why it matters
Third paragraph:  Give 2-3 specific, actionable steps they can take right now`;
  }

  if (context.budget > 0) {
    const daysInMonth   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - new Date().getDate();
    systemMsg += `\n\nUser's Current Financial Situation:`;
    systemMsg += `\n• Budget:    ₱${Math.round(context.budget)}`;
    systemMsg += `\n• Spent:     ₱${Math.round(context.spent)} (${context.percentage}% of budget)`;
    systemMsg += `\n• Remaining: ₱${Math.round(context.remaining)}`;
    systemMsg += `\n• Days left in month: ${daysRemaining}`;
    systemMsg += `\n• Transactions this month: ${context.txCount}`;
    if (context.topCategory) {
      const catPct = context.budget > 0 ? ((context.topAmount / context.budget) * 100).toFixed(0) : 0;
      systemMsg += `\n• Highest spending category: ${context.topCategory} at ₱${Math.round(context.topAmount)} (${catPct}% of budget)`;
    }
    if (context.lastMonthSpent > 0)
      systemMsg += `\n• Vs last month: ${context.vsLastMonth > 0 ? '+' : ''}${context.vsLastMonth}% change in spending`;
    if (context.goalsCount > 0) {
      const goalsPct = context.goalsTarget > 0
        ? ((context.goalsSaved / context.goalsTarget) * 100).toFixed(0) : 0;
      systemMsg += `\n• Savings goals: ${context.goalsCount} active, ${goalsPct}% progress (₱${Math.round(context.goalsSaved)} of ₱${Math.round(context.goalsTarget)})`;
    }
    systemMsg += `\n\nUSE THESE NUMBERS in your response. Be specific, not generic.`;
  }

  const prompt = `<|system|>${systemMsg}<|end|><|user|>${message}<|end|><|assistant|>`;
  return { prompt, maxTokens };
}

// ─── Response cleaner ─────────────────────────────────────────────────────────

function cleanResponse(text) {
  text = text
    .replace(/^(Assistant:|AI:|PESO AI:)\s*/i, '')
    .replace(/<\|.*?\|>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u2600-\u27BF]/g, '')
    .replace(/#\w+/g, '')
    .replace(/\d+\/\d+:/g, '')
    .replace(/Step \d+:/gi, '')
    .replace(/^(Opening|Analysis|Action|Recommendation|Summary|Introduction|Conclusion):\s*/gim, '')
    .trim();

  text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ');
  text = text.replace(/\s*\[\s*\]/g, '');

  if (!text.includes('\n\n') && text.split('. ').length > 3) {
    text = text.replace(/\.\s+([A-Z])/g, '.\n\n$1');
  }

  if (!text.match(/[.!?]$/)) {
    const lastPeriod = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
    if (lastPeriod > text.length * 0.7) {
      text = text.substring(0, lastPeriod + 1);
    } else {
      text = text.replace(/[,;:]$/, '.');
      if (!text.match(/[.!?]$/)) text += '.';
    }
  }

  return text.trim().replace(/\n /g, '\n').replace(/  +/g, ' ');
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function getCacheKey(userId, message, mode) {
  return `${userId}:${mode}:${message.substring(0, 50).toLowerCase()}`;
}

function getCachedResponse(userId, message, mode) {
  const key    = getCacheKey(userId, message, mode);
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.response;
  return null;
}

function cacheResponse(userId, message, mode, response) {
  const key = getCacheKey(userId, message, mode);
  responseCache.set(key, { response, timestamp: Date.now() });
  if (responseCache.size > 100) responseCache.delete(responseCache.keys().next().value);
}

// ─── POST /api/ai/chat/:userId ────────────────────────────────────────────────

const chatWithAI = async (req, res) => {
  const { userId } = req.params;
  let { message, mode } = req.body;

  if (!isNonEmptyString(message)) return validationError(res, 'Message cannot be empty.');

  message       = sanitizeString(message);
  const aiMode  = isValidAIMode(mode) ? mode : 'general';
  const timeout = aiMode === 'advanced' ? ADVANCED_TIMEOUT : GENERAL_TIMEOUT;

  try {
    try {
      await axios.get(`${LLAMA_URL}/health`, { timeout: 2000 });
    } catch {
      return res.status(503).json({ success: false, response: 'AI assistant is temporarily unavailable.' });
    }

    const cached = getCachedResponse(userId, message, aiMode);
    if (cached) return res.json({ success: true, response: cached });

    let context = {};
    try {
      context = await Promise.race([
        getUserContext(userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
    } catch {
      context = { budget: 0, spent: 0, income: 0, remaining: 0, percentage: 0, txCount: 0 };
    }

    message = resolveReferences(message, userId);
    message = enrichFollowUp(message, userId, context);

    const { prompt, maxTokens } = buildOptimizedPrompt(message, context, aiMode);

    const llamaResponse = await axios.post(`${LLAMA_URL}/completion`, {
      prompt, n_predict: maxTokens, temperature: 0.7, top_k: 40, top_p: 0.9,
      repeat_penalty: 1.1, min_keep: 0, tfs_z: 1.0, typical_p: 1.0,
      presence_penalty: 0.0, frequency_penalty: 0.0, mirostat: 0,
      stop: ['<|end|>', '<|user|>', '\n\nUser:', '\n\n---', '<|endoftext|>'],
      cache_prompt: true, seed: -1,
      logit_bias: [[13, -10.0], [198, -5.0]],
    }, { timeout });

    let reply = llamaResponse.data.content.trim();
    reply = cleanResponse(reply);

    const conv = conversations.get(userId) || { history: [], lastAccess: Date.now() };
    conv.history.push({ role: 'user', content: message });
    conv.history.push({ role: 'assistant', content: reply });
    conv.history    = conv.history.slice(-MAX_HISTORY);
    conv.lastAccess = Date.now();
    conversations.set(userId, conv);

    lastResponses.set(userId, { message, response: reply, entities: extractEntities(reply), timestamp: Date.now() });
    const topic = detectTopic(message, context);
    sessionMemory.set(userId, { ...topic, timestamp: Date.now() });
    cacheResponse(userId, message, aiMode, reply);

    return res.json({ success: true, response: reply });

  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        response: aiMode === 'advanced'
          ? 'Response took too long. Try a simpler question or switch to General mode.'
          : 'Request timed out. Please try again.',
      });
    }
    console.error('[AI] chatWithAI error:', err.message);
    return res.status(500).json({ success: false, response: MESSAGES.AI_RESPONSE_FAILED });
  }
};

// ─── GET /api/ai/insights/:userId ────────────────────────────────────────────

async function getComprehensiveFinancialData(userId) {
  try {
    const result = await pool.query(`
      WITH current_month AS (
        SELECT
          COALESCE(SUM(amount), 0) AS spent,
          COUNT(*) AS count
        FROM transactions
        WHERE user_id = $1
          AND transaction_type = 'expense'
          AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
      ),
      last_month AS (
        SELECT COALESCE(SUM(amount), 0) AS spent
        FROM transactions
        WHERE user_id = $1 AND transaction_type = 'expense'
          AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          AND transaction_date <  DATE_TRUNC('month', CURRENT_DATE)
      ),
      top_cats AS (
        SELECT json_agg(json_build_object('category', category, 'amount', amount) ORDER BY amount DESC) AS cats
        FROM (
          SELECT category, SUM(amount) AS amount
          FROM transactions
          WHERE user_id = $1 AND transaction_type = 'expense'
            AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
          GROUP BY category ORDER BY amount DESC LIMIT 3
        ) sub
      )
      SELECT cm.spent, cm.count,
             (SELECT monthly_income FROM user_profiles WHERE user_id = $1) AS budget,
             lm.spent AS last_spent, tc.cats AS categories
      FROM current_month cm CROSS JOIN last_month lm CROSS JOIN top_cats tc
    `, [userId]);

    const data = result.rows[0];
    return {
      hasData:        (parseInt(data.count, 10) || 0) > 0,
      spent:          parseFloat(data.spent      || 0),
      budget:         parseFloat(data.budget     || 0),
      lastMonthSpent: parseFloat(data.last_spent || 0),
      expenseCount:   parseInt(data.count        || 0, 10),
      categories:     data.categories            || [],
    };
  } catch (err) {
    console.error('[AI Insights] getComprehensiveFinancialData error:', err.message);
    return { hasData: false };
  }
}

function buildInsightsPrompt(data) {
  const { spent, income, budget, lastMonthSpent, categories } = data;
  const remaining   = budget - spent;
  const percentUsed = budget > 0 ? ((spent / budget) * 100).toFixed(0) : 0;
  const vsLastMonth = lastMonthSpent > 0
    ? (((spent - lastMonthSpent) / lastMonthSpent) * 100).toFixed(0) : 0;
  const topCats = categories && categories.length > 0
    ? categories.slice(0, 3).map((c) => `${c.category} ₱${Math.round(c.amount)}`).join(', ')
    : 'no data';

  return `<|system|>PESO AI analyst. Generate complete insights with clear formatting.

Format (use blank lines between sections):

SUMMARY: [1 complete sentence about status]

RECOMMENDATIONS:
- [complete action 1]
- [complete action 2]
- [complete action 3]

TRENDS:
- [complete trend 1]
- [complete trend 2]

ALERTS:
- [warning or "None"]

Always finish all sections.<|end|><|user|>Budget ₱${Math.round(budget)}, Spent ₱${Math.round(spent)} (${percentUsed}%), Remaining ₱${Math.round(remaining)}, vs Last Month ${vsLastMonth > 0 ? '+' : ''}${vsLastMonth}%
Top: ${topCats}
Generate insights.<|end|><|assistant|>`;
}

function parseInsights(rawText, financialData) {
  const insights = { summary: '', recommendations: [], trends: [], alerts: [] };
  try {
    let currentSection = '';
    for (const line of rawText.split('\n').filter((l) => l.trim())) {
      const trimmed = line.trim();
      if (trimmed.startsWith('SUMMARY:'))         { currentSection = 'summary'; insights.summary = trimmed.replace('SUMMARY:', '').trim(); }
      else if (trimmed.startsWith('RECOMMENDATIONS:')) currentSection = 'recommendations';
      else if (trimmed.startsWith('TRENDS:'))         currentSection = 'trends';
      else if (trimmed.startsWith('ALERTS:'))          currentSection = 'alerts';
      else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        const text = trimmed.replace(/^[-•]\s*/, '').trim();
        if (text && text.toLowerCase() !== 'none') {
          if (currentSection === 'recommendations') insights.recommendations.push(text);
          else if (currentSection === 'trends')     insights.trends.push(text);
          else if (currentSection === 'alerts')     insights.alerts.push(text);
        }
      }
    }
    if (!insights.summary) {
      const remaining = financialData.budget - financialData.spent;
      insights.summary = remaining >= 0
        ? `You've spent ₱${Math.round(financialData.spent)} of your ₱${Math.round(financialData.budget)} budget, with ₱${Math.round(remaining)} remaining this month.`
        : `You're ₱${Math.round(Math.abs(remaining))} over your ₱${Math.round(financialData.budget)} budget this month.`;
    }
    if (insights.recommendations.length === 0) {
      insights.recommendations.push('Track all expenses daily to stay aware of your spending.');
      insights.recommendations.push('Review your top spending categories to find areas to cut back.');
    }
  } catch (err) {
    console.error('[AI Insights] parseInsights error:', err.message);
    insights.summary = 'Unable to generate detailed insights at this time.';
  }
  return insights;
}

const generateInsights = async (req, res) => {
  const { userId } = req.params;
  try {
    try { await axios.get(`${LLAMA_URL}/health`, { timeout: 1500 }); }
    catch { return res.status(503).json({ success: false, message: MESSAGES.AI_HEALTH_FAIL }); }

    let financialData;
    try {
      financialData = await Promise.race([
        getComprehensiveFinancialData(userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ]);
    } catch { financialData = { hasData: false }; }

    if (!financialData.hasData) {
      return res.json({
        success: true,
        insights: {
          summary:         'Start tracking expenses to receive personalised insights!',
          recommendations: ['Track daily expenses to build spending awareness.', 'Set a monthly budget to guide your finances.'],
          trends:  [],
          alerts:  [],
        },
      });
    }

    const response = await axios.post(`${LLAMA_URL}/completion`, {
      prompt:         buildInsightsPrompt(financialData),
      n_predict:      400, temperature: 0.7, top_k: 40, top_p: 0.9,
      repeat_penalty: 1.1,
      stop:           ['<|end|>', '<|user|>', '---END---'],
      cache_prompt:   true,
    }, { timeout: INSIGHTS_TIMEOUT });

    return res.json({ success: true, insights: parseInsights(response.data.content.trim(), financialData) });

  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({ success: false, message: 'Insights generation timed out.' });
    }
    console.error('[AI Insights] generateInsights error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.AI_INSIGHTS_FAILED });
  }
};

// ─── Conversation management ──────────────────────────────────────────────────

const clearConversation = (req, res) => {
  const { userId } = req.params;
  conversations.delete(userId);
  lastResponses.delete(userId);
  sessionMemory.delete(userId);
  return res.json({ success: true, message: MESSAGES.AI_CLEARED });
};

const getChatHistory = (req, res) => {
  const { userId } = req.params;
  const conv = conversations.get(userId);
  if (!conv || conv.history.length === 0) return res.json({ success: true, history: [], count: 0 });
  return res.json({ success: true, history: conv.history, count: Math.floor(conv.history.length / 2) });
};

const checkHealth = async (req, res) => {
  try {
    await axios.get(`${LLAMA_URL}/health`, { timeout: 2000 });
    return res.json({ success: true, status: 'healthy', active_conversations: conversations.size, cached_responses: responseCache.size });
  } catch {
    return res.status(503).json({ success: false, status: 'unhealthy', error: 'llama.cpp server not responding.' });
  }
};

// ─── History persistence ──────────────────────────────────────────────────────

const saveConversationHistory = async (req, res) => {
  const { userId }        = req.params;
  const { messages, mode } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) return validationError(res, 'Messages array is required.');
  if (messages.some((m) => typeof m.role !== 'string' || typeof m.content !== 'string'))
    return validationError(res, 'Each message must have a string role and content.');

  const safeMode     = isValidAIMode(mode) ? mode : 'general';
  const exchangeCount = Math.floor(messages.length / 2);

  try {
    const result = await pool.query(
      `INSERT INTO chat_history (user_id, messages, mode, exchange_count)
       VALUES ($1, $2, $3, $4)
       RETURNING id, conversation_date`,
      [userId, JSON.stringify(messages), safeMode, exchangeCount]
    );
    return res.json({ success: true, historyId: result.rows[0].id, savedAt: result.rows[0].conversation_date });
  } catch (err) {
    console.error('[AI] saveConversationHistory error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.AI_HISTORY_SAVE_FAILED });
  }
};

const getConversationHistory = async (req, res) => {
  const { userId }              = req.params;
  const { page, limit, offset } = parsePagination(req.query, 10, 50);

  try {
    const [countResult, result] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM chat_history WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT id, conversation_date, messages, mode, exchange_count
         FROM chat_history WHERE user_id = $1
         ORDER BY conversation_date DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
    ]);

    const total      = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      history: result.rows,
      count:   result.rows.length,
      pagination: { currentPage: page, totalPages, totalConversations: total, hasMore: page < totalPages, limit },
    });
  } catch (err) {
    console.error('[AI] getConversationHistory error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.AI_HISTORY_FETCH_FAILED });
  }
};

const getConversationById = async (req, res) => {
  const { userId, historyId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, conversation_date, messages, mode, exchange_count
       FROM chat_history WHERE id = $1 AND user_id = $2`,
      [historyId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: MESSAGES.AI_CONVERSATION_NOT_FOUND });
    return res.json({ success: true, conversation: result.rows[0] });
  } catch (err) {
    console.error('[AI] getConversationById error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.AI_HISTORY_FETCH_FAILED });
  }
};

const deleteConversationHistory = async (req, res) => {
  const { userId, historyId } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM chat_history WHERE id = $1 AND user_id = $2 RETURNING id',
      [historyId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: MESSAGES.AI_CONVERSATION_NOT_FOUND });
    return res.json({ success: true, message: MESSAGES.AI_HISTORY_DELETE_SUCCESS });
  } catch (err) {
    console.error('[AI] deleteConversationHistory error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.AI_HISTORY_DELETE_FAILED });
  }
};

export { chatWithAI, clearConversation, getChatHistory, checkHealth,
  generateInsights, saveConversationHistory, getConversationHistory,
  getConversationById, deleteConversationHistory, };