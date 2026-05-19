// Robust 3-strategy JSON parser for AI responses
// Strategy 1: parse raw content directly
// Strategy 2: strip markdown code fences (```json ... ```), then parse
// Strategy 3: extract first {...} or [...] block by brace matching, then parse
//
// Returns { success, data, raw, strategy } - never throws.

function parseAIJson(content) {
  if (content === null || content === undefined) {
    return { success: false, data: null, raw: '', strategy: 'none', error: 'empty' };
  }

  if (typeof content === 'object') {
    return { success: true, data: content, raw: JSON.stringify(content), strategy: 'object' };
  }

  const raw = String(content);
  const trimmed = raw.trim();

  // Strategy 1: direct parse
  try {
    const data = JSON.parse(trimmed);
    return { success: true, data, raw, strategy: 'direct' };
  } catch (_) {
    // continue
  }

  // Strategy 2: strip markdown fences
  const fenced = trimmed
    .replace(/^```(?:json|javascript|js)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  if (fenced && fenced !== trimmed) {
    try {
      const data = JSON.parse(fenced);
      return { success: true, data, raw, strategy: 'fenced' };
    } catch (_) {
      // continue
    }
  }

  // Strategy 3: extract first balanced JSON block via brace counting
  const extracted = extractFirstJsonBlock(fenced || trimmed);
  if (extracted) {
    try {
      const data = JSON.parse(extracted);
      return { success: true, data, raw, strategy: 'extracted' };
    } catch (_) {
      // continue
    }
  }

  return { success: false, data: null, raw, strategy: 'failed', error: 'not valid JSON after 3 strategies' };
}

function extractFirstJsonBlock(text) {
  let start = -1;
  let openChar = null;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') {
      start = i;
      openChar = text[i];
      break;
    }
  }
  if (start === -1) return null;

  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

module.exports = { parseAIJson };
module.exports.parseAIJson = parseAIJson;
module.exports.default = parseAIJson;
