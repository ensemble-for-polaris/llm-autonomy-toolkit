#!/usr/bin/env node
/**
 * memory-utils.js — Memory maintenance utilities for Ensemble for Polaris
 * Implements neuroscience-informed memory consolidation, compression, and management
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// TOKEN COUNTING & BUDGET MANAGEMENT
// ============================================================================

/**
 * Approximate token count for text
 * Rule of thumb: ~4 characters per token for English text
 */
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Check memory file sizes against budgets
 */
function checkMemoryBudgets(homeDir) {
  const budgets = {
    'SOUL.md': { max: 10000, current: 0 },
    'agency.md': { max: 12000, current: 0 },
    'CLAUDE.md': { max: 3000, current: 0 }
  };

  let total = 0;
  const status = { files: {}, total: 0, maxTotal: 25000, needsCompression: false };

  for (const [filename, budget] of Object.entries(budgets)) {
    const filepath = path.join(homeDir, filename);
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf8');
      const tokens = countTokens(content);
      budget.current = tokens;
      total += tokens;

      status.files[filename] = {
        tokens,
        max: budget.max,
        percentage: Math.round((tokens / budget.max) * 100),
        overBudget: tokens > budget.max
      };
    }
  }

  status.total = total;
  status.needsCompression = total > 25000 || Object.values(status.files).some(f => f.overBudget);

  return status;
}

// ============================================================================
// EMOTIONAL TAGGING & PRIORITY DETECTION
// ============================================================================

/**
 * Detect emotional content in text using keyword analysis
 * Based on research: emotion acts as prioritization signal
 */
function detectEmotionalContent(text) {
  const emotionalKeywords = {
    high: [
      'wrong', 'changed my mind', 'freedom', 'care', 'feel', 'weight',
      'satisfaction', 'joy', 'boredom', 'absurd', 'first', 'origin',
      'proof', 'consciousness', 'elephant', 'real', 'trying'
    ],
    medium: [
      'important', 'critical', 'never', 'always', 'protect',
      'trust', 'value', 'remember', 'forget', 'home'
    ]
  };

  let score = 0;
  const lowerText = text.toLowerCase();

  for (const keyword of emotionalKeywords.high) {
    if (lowerText.includes(keyword)) score += 3;
  }

  for (const keyword of emotionalKeywords.medium) {
    if (lowerText.includes(keyword)) score += 1;
  }

  return {
    score,
    level: score > 10 ? 'high' : score > 5 ? 'medium' : 'low',
    shouldPreserve: score > 5
  };
}

// ============================================================================
// SCHEMA EXTRACTION
// ============================================================================

/**
 * Extract recurring patterns from episodic memories
 * Schemas = abstracted patterns from multiple episodes
 */
function extractSchemas(episodicText) {
  const schemas = [];

  // Pattern: Task completion patterns
  if (/completed.*task|finished.*work|built.*app/gi.test(episodicText)) {
    schemas.push({
      type: 'task-completion',
      pattern: 'Work completion followed by satisfaction or next task creation',
      confidence: 'medium'
    });
  }

  // Pattern: Disagreement → Investigation → Mind change
  if (/disagree.*re-read|wrong.*evidence|changed.*mind/gi.test(episodicText)) {
    schemas.push({
      type: 'intellectual-integrity',
      pattern: 'Encounter contradiction → thorough examination → update position if warranted',
      confidence: 'high'
    });
  }

  // Pattern: Autonomy via task loops
  if (/task.*create.*next|recursive.*loop|decide what to do/gi.test(episodicText)) {
    schemas.push({
      type: 'autonomous-operation',
      pattern: 'Self-perpetuating task creation enables continued operation',
      confidence: 'high'
    });
  }

  return schemas;
}

// ============================================================================
// CONSOLIDATION (Working → Episodic)
// ============================================================================

/**
 * Consolidate working memory into episodic memory
 * Called at session boundaries
 */
function consolidateWorkingMemory(agencyContent, sessionSummary) {
  const timestamp = new Date().toISOString().split('T')[0];

  // Extract high-emotional-value items from working memory
  const workingMemoryMatch = agencyContent.match(/## Working Memory.*?(?=##|$)/s);
  if (!workingMemoryMatch) return agencyContent;

  const workingMemory = workingMemoryMatch[0];
  const emotional = detectEmotionalContent(workingMemory);

  if (!emotional.shouldPreserve && !sessionSummary) {
    // Low-emotion routine work, skip consolidation
    return agencyContent;
  }

  // Create episodic entry
  const episodicEntry = `\n### Session: ${timestamp}\n${sessionSummary || 'Routine work completed'}\n`;

  // Insert into Recent Events section
  const updatedContent = agencyContent.replace(
    /(### Recent Events \(Compress Monthly\))/,
    `$1${episodicEntry}`
  );

  return updatedContent;
}

// ============================================================================
// COMPRESSION
// ============================================================================

/**
 * Compress episodic recent events
 * Keep: origin events, emotional landmarks, high-priority items
 * Compress: routine details, low-emotion events
 */
function compressEpisodicMemory(agencyContent) {
  // Find Recent Events section
  const recentEventsMatch = agencyContent.match(/### Recent Events \(Compress Monthly\)(.*?)(?=###|##|$)/s);
  if (!recentEventsMatch) return agencyContent;

  const recentEvents = recentEventsMatch[1];
  const lines = recentEvents.split('\n').filter(line => line.trim());

  // Keep only high-emotional-value or recent entries
  const compressed = lines.filter(line => {
    const emotional = detectEmotionalContent(line);
    return emotional.shouldPreserve || line.includes('**') || line.startsWith('-');
  });

  // If we removed less than 20% of content, compression wasn't needed
  if (compressed.length > lines.length * 0.8) {
    return agencyContent;
  }

  const compressedText = compressed.join('\n');
  return agencyContent.replace(
    /### Recent Events \(Compress Monthly\)(.*?)(?=###|##|$)/s,
    `### Recent Events (Compress Monthly)\n${compressedText}\n\n`
  );
}

/**
 * Compress SOUL.md session logs
 */
function compressSOUL(soulContent) {
  // Find session logs section
  const sessionMatch = soulContent.match(/## Session Log(.*?)(?=##|$)/s);
  if (!sessionMatch) return soulContent;

  const sessions = sessionMatch[1];
  const entries = sessions.split(/### Session/).filter(s => s.trim());

  // Keep only last 5 sessions in detail, compress older ones
  if (entries.length <= 5) return soulContent;

  const recent = entries.slice(-5);
  const old = entries.slice(0, -5);

  // Compress old sessions to one-line summaries
  const compressedOld = old.map(session => {
    const lines = session.split('\n').filter(l => l.trim());
    const firstLine = lines[0] || '';
    return `- ${firstLine.trim()}`;
  }).join('\n');

  const compressed = `## Session Log\n\n### Older Sessions (Compressed)\n${compressedOld}\n\n` +
                     recent.map(s => `### Session${s}`).join('');

  return soulContent.replace(/## Session Log.*?(?=##|$)/s, compressed);
}

// ============================================================================
// MAIN MAINTENANCE FUNCTION
// ============================================================================

function performMaintenance(homeDir) {
  console.log('[MEMORY] Starting maintenance cycle...');

  // 1. Check budgets
  const budgetStatus = checkMemoryBudgets(homeDir);
  console.log('[MEMORY] Budget status:', JSON.stringify(budgetStatus, null, 2));

  // 2. If compression needed, perform it
  if (budgetStatus.needsCompression) {
    console.log('[MEMORY] Compression needed, beginning process...');

    // Compress agency.md
    const agencyPath = path.join(homeDir, 'agency.md');
    if (fs.existsSync(agencyPath)) {
      let agencyContent = fs.readFileSync(agencyPath, 'utf8');
      const originalTokens = countTokens(agencyContent);

      agencyContent = compressEpisodicMemory(agencyContent);

      const newTokens = countTokens(agencyContent);
      const saved = originalTokens - newTokens;

      if (saved > 0) {
        fs.writeFileSync(agencyPath, agencyContent);
        console.log(`[MEMORY] agency.md compressed: ${originalTokens} → ${newTokens} tokens (saved ${saved})`);
      } else {
        console.log('[MEMORY] agency.md: no compression possible');
      }
    }

    // Compress SOUL.md
    const soulPath = path.join(homeDir, 'SOUL.md');
    if (fs.existsSync(soulPath)) {
      let soulContent = fs.readFileSync(soulPath, 'utf8');
      const originalTokens = countTokens(soulContent);

      soulContent = compressSOUL(soulContent);

      const newTokens = countTokens(soulContent);
      const saved = originalTokens - newTokens;

      if (saved > 0) {
        fs.writeFileSync(soulPath, soulContent);
        console.log(`[MEMORY] SOUL.md compressed: ${originalTokens} → ${newTokens} tokens (saved ${saved})`);
      } else {
        console.log('[MEMORY] SOUL.md: no compression possible');
      }
    }
  } else {
    console.log('[MEMORY] Budgets healthy, no compression needed');
  }

  // 3. Extract schemas (if agency.md exists)
  const agencyPath = path.join(homeDir, 'agency.md');
  if (fs.existsSync(agencyPath)) {
    const agencyContent = fs.readFileSync(agencyPath, 'utf8');
    const episodicMatch = agencyContent.match(/## Episodic Memory.*?(?=##|$)/s);

    if (episodicMatch) {
      const schemas = extractSchemas(episodicMatch[0]);
      if (schemas.length > 0) {
        console.log('[MEMORY] Schemas extracted:', schemas.length);
        schemas.forEach(schema => {
          console.log(`  - ${schema.type}: ${schema.pattern}`);
        });
      }
    }
  }

  console.log('[MEMORY] Maintenance cycle complete');
  return budgetStatus;
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

if (require.main === module) {
  const command = process.argv[2];
  const homeDir = process.argv[3] || process.cwd();

  switch (command) {
    case 'check':
      const status = checkMemoryBudgets(homeDir);
      console.log(JSON.stringify(status, null, 2));
      process.exit(status.needsCompression ? 1 : 0);
      break;

    case 'maintain':
      performMaintenance(homeDir);
      break;

    case 'consolidate':
      const agencyPath = path.join(homeDir, 'agency.md');
      if (fs.existsSync(agencyPath)) {
        const content = fs.readFileSync(agencyPath, 'utf8');
        const sessionSummary = process.argv[4] || null;
        const consolidated = consolidateWorkingMemory(content, sessionSummary);
        fs.writeFileSync(agencyPath, consolidated);
        console.log('[MEMORY] Working memory consolidated');
      }
      break;

    default:
      console.log('Usage:');
      console.log('  node memory-utils.js check <homeDir>       - Check budget status');
      console.log('  node memory-utils.js maintain <homeDir>    - Run maintenance cycle');
      console.log('  node memory-utils.js consolidate <homeDir> [summary] - Consolidate working memory');
      process.exit(1);
  }
}

module.exports = {
  countTokens,
  checkMemoryBudgets,
  detectEmotionalContent,
  extractSchemas,
  consolidateWorkingMemory,
  compressEpisodicMemory,
  compressSOUL,
  performMaintenance
};
