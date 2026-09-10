// Generic identifier extraction for arbitrary Discord log embeds.
//
// The log channels are fed by many different, uncoordinated FiveM scripts, so
// there is no single embed schema to rely on. Two things stay stable across
// almost all of them though:
//   1. FiveM's own identifier list format (steam:, license:, discord:, ...)
//      shows up verbatim in most ban/kick/join logs, regardless of layout.
//   2. Discord user mentions (<@id>) are always mentions, never anything else.
// Everything else (character name, citizenid, server slot) is extracted on a
// best-effort basis by matching common field-name aliases.

const IDENTIFIER_PATTERNS = [
  { type: 'LICENSE2', regex: /\blicense2:([0-9a-f]{20,50})\b/gi },
  { type: 'LICENSE', regex: /\blicense:([0-9a-f]{20,50})\b/gi },
  { type: 'STEAM', regex: /\bsteam:([0-9a-f]{15,20})\b/gi },
  { type: 'XBL', regex: /\bxbl:(\d{5,20})\b/gi },
  { type: 'LIVE', regex: /\blive:(\d{5,20})\b/gi },
  { type: 'FIVEM', regex: /\bfivem:(\d{1,20})\b/gi },
  { type: 'IP', regex: /\bip:(\d{1,3}(?:\.\d{1,3}){3})\b/gi },
  { type: 'DISCORD', regex: /\bdiscord:(\d{15,20})\b/gi },
];

const MENTION_REGEX = /<@!?(\d{15,20})>/g;
const LABELED_DISCORD_REGEX = /discord\s*(?:id)?\s*[:\-]\s*(?:<@!?)?(\d{15,20})>?/gi;
const CITIZENID_TEXT_REGEX = /citizen\s*id\s*[:\-]?\s*`?([A-Z0-9]{6,10})`?/gi;

const NAME_FIELD_ALIASES = new Set(['character', 'char name', 'charname', 'name', 'player', 'ic name', 'nev', 'név', 'karakter', 'karakternév']);
const SERVERID_FIELD_ALIASES = new Set(['id', 'player id', 'source', 'slot', 'server id', 'serverid']);
const CITIZENID_FIELD_ALIASES = new Set(['citizenid', 'citizen id', 'cid']);

function extractFromText(text, results) {
  if (!text) return;
  for (const { type, regex } of IDENTIFIER_PATTERNS) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text))) {
      results.push({ type, value: m[1].toLowerCase() });
    }
  }
  MENTION_REGEX.lastIndex = 0;
  let m;
  while ((m = MENTION_REGEX.exec(text))) {
    results.push({ type: 'DISCORD', value: m[1] });
  }
  LABELED_DISCORD_REGEX.lastIndex = 0;
  while ((m = LABELED_DISCORD_REGEX.exec(text))) {
    results.push({ type: 'DISCORD', value: m[1] });
  }
  CITIZENID_TEXT_REGEX.lastIndex = 0;
  while ((m = CITIZENID_TEXT_REGEX.exec(text))) {
    results.push({ type: 'CITIZENID', value: m[1].toUpperCase() });
  }
}

function normalizeFieldName(name) {
  return name.toLowerCase().replace(/[*_`~]/g, '').trim();
}

function extractFromFields(fields, results) {
  for (const f of fields) {
    const key = normalizeFieldName(f.name || '');
    const cleanValue = (f.value || '').replace(/[`*_~]/g, '').trim();

    if (cleanValue) {
      if (CITIZENID_FIELD_ALIASES.has(key) && /^[A-Z0-9]{6,10}$/i.test(cleanValue)) {
        results.push({ type: 'CITIZENID', value: cleanValue.toUpperCase() });
      } else if (SERVERID_FIELD_ALIASES.has(key) && /^\d{1,4}$/.test(cleanValue)) {
        results.push({ type: 'SERVER_ID', value: cleanValue });
      } else if (NAME_FIELD_ALIASES.has(key) && cleanValue.length <= 100) {
        results.push({ type: 'CHARACTER_NAME', value: cleanValue });
      }
    }

    // Always also scan the raw value text: many scripts dump the full
    // identifiers list inside a single field's value rather than the title.
    extractFromText(f.value, results);
  }
}

function extractIdentifiers({ title, description, fields, footerText, authorName } = {}) {
  const results = [];
  extractFromText(title, results);
  extractFromText(description, results);
  extractFromText(footerText, results);
  extractFromText(authorName, results);
  if (fields && fields.length) extractFromFields(fields, results);

  const seen = new Set();
  const deduped = [];
  for (const r of results) {
    const key = `${r.type}:${r.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }
  return deduped;
}

module.exports = { extractIdentifiers };
