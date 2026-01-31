#!/usr/bin/env node
/**
 * prospective-memory.js — Prospective Memory System for Ensemble for Polaris
 * Implements neuroscience-informed future intention management
 *
 * Based on research: dual-pathway retrieval (monitoring + spontaneous),
 * five-phase model (formation → retention → retrieval → execution → evaluation),
 * implementation intentions (if-then planning)
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PM_DIR = path.join(__dirname, '..', 'pm');
const INTENTIONS_DIR = path.join(PM_DIR, 'intentions');
const COMPLETED_DIR = path.join(PM_DIR, 'completed');
const LOGS_DIR = path.join(PM_DIR, 'logs');

// Ensure directories exist
[PM_DIR, INTENTIONS_DIR, COMPLETED_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================================================
// PHASE 1: INTENTION FORMATION (ENCODING)
// ============================================================================

/**
 * Create a new prospective memory intention
 * Implements structured encoding with if-then planning
 */
function createIntention(spec) {
  const {
    action,              // What to do (specific, concrete)
    triggerType,         // 'event' | 'time'
    triggerSpec,         // Cue description or timestamp
    context = null,      // Under what conditions (optional)
    priority = 'medium', // 'low' | 'medium' | 'high'
    metadata = {}        // Additional data
  } = spec;

  // Validate required fields
  if (!action || !triggerType || !triggerSpec) {
    throw new Error('Missing required fields: action, triggerType, triggerSpec');
  }

  // Generate unique ID
  const id = `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();

  const intention = {
    id,
    phase: 'retention', // After formation, enter retention phase
    action,
    triggerType,
    triggerSpec,
    context,
    priority,
    metadata,
    created: timestamp,
    lastChecked: null,
    checkCount: 0,
    state: 'active' // active | triggered | executing | completed | failed
  };

  // Write to file
  const filepath = path.join(INTENTIONS_DIR, `${id}.json`);
  fs.writeFileSync(filepath, JSON.stringify(intention, null, 2));

  logEvent('formation', id, `Created intention: "${action}"`);

  return intention;
}

// ============================================================================
// PHASE 2: INTENTION RETENTION (MAINTENANCE)
// ============================================================================

/**
 * Load all active intentions
 */
function loadActiveIntentions() {
  if (!fs.existsSync(INTENTIONS_DIR)) return [];

  const files = fs.readdirSync(INTENTIONS_DIR).filter(f => f.endsWith('.json'));
  const intentions = files.map(f => {
    const content = fs.readFileSync(path.join(INTENTIONS_DIR, f), 'utf8');
    return JSON.parse(content);
  }).filter(i => i.state === 'active');

  return intentions;
}

/**
 * Update intention state
 */
function updateIntention(id, updates) {
  const filepath = path.join(INTENTIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Intention ${id} not found`);
  }

  const intention = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const updated = { ...intention, ...updates };
  fs.writeFileSync(filepath, JSON.stringify(updated, null, 2));

  return updated;
}

// ============================================================================
// PHASE 3: CUE DETECTION & INTENTION RETRIEVAL (INITIATION)
// ============================================================================

/**
 * DUAL-PATHWAY RETRIEVAL SYSTEM
 */

/**
 * Pathway 1: Spontaneous Retrieval (Event-Based, Focal Cues)
 * Automatic, bottom-up, triggered by cue detection
 */
function checkEventBasedIntentions(currentContext) {
  const intentions = loadActiveIntentions();
  const eventBased = intentions.filter(i => i.triggerType === 'event');
  const triggered = [];

  for (const intention of eventBased) {
    // Check if cue matches current context
    const cueDetected = detectCue(intention.triggerSpec, currentContext);

    if (cueDetected) {
      // Context check (if specified)
      if (intention.context && !matchesContext(intention.context, currentContext)) {
        continue;
      }

      // Mark as triggered
      updateIntention(intention.id, {
        state: 'triggered',
        phase: 'execution',
        triggeredAt: new Date().toISOString()
      });

      triggered.push(intention);
      logEvent('retrieval', intention.id, `Cue detected: "${intention.triggerSpec}"`);
    }
  }

  return triggered;
}

/**
 * Pathway 2: Monitoring (Time-Based, Nonfocal Cues)
 * Resource-intensive, top-down, requires active checking
 */
function checkTimeBasedIntentions() {
  const intentions = loadActiveIntentions();
  const timeBased = intentions.filter(i => i.triggerType === 'time');
  const triggered = [];
  const now = Date.now();

  for (const intention of timeBased) {
    // Update check count
    updateIntention(intention.id, {
      lastChecked: new Date().toISOString(),
      checkCount: intention.checkCount + 1
    });

    // Parse trigger time
    const targetTime = new Date(intention.triggerSpec).getTime();

    // Check if time has arrived (with small tolerance)
    const tolerance = 60000; // 1 minute
    if (Math.abs(now - targetTime) < tolerance) {
      updateIntention(intention.id, {
        state: 'triggered',
        phase: 'execution',
        triggeredAt: new Date().toISOString()
      });

      triggered.push(intention);
      logEvent('retrieval', intention.id, `Time reached: ${intention.triggerSpec}`);
    }
  }

  return triggered;
}

/**
 * Cue detection logic (event-based)
 */
function detectCue(cueSpec, context) {
  // Simple keyword matching for now
  // Can be enhanced with more sophisticated pattern matching
  if (!context || !context.text) return false;

  const normalizedCue = cueSpec.toLowerCase();
  const normalizedContext = context.text.toLowerCase();

  return normalizedContext.includes(normalizedCue);
}

/**
 * Context matching
 */
function matchesContext(requiredContext, currentContext) {
  // Simple implementation - check if required context keys match
  for (const [key, value] of Object.entries(requiredContext)) {
    if (currentContext[key] !== value) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// PHASE 4: INTENTION EXECUTION (ACTION)
// ============================================================================

/**
 * Execute a triggered intention
 * Returns execution result for evaluation phase
 */
function executeIntention(intention, executor) {
  logEvent('execution', intention.id, `Executing: "${intention.action}"`);

  updateIntention(intention.id, {
    state: 'executing',
    executionStarted: new Date().toISOString()
  });

  try {
    // Call executor function with intention details
    const result = executor(intention);

    // Mark as completed
    updateIntention(intention.id, {
      state: 'completed',
      phase: 'evaluation',
      executionCompleted: new Date().toISOString(),
      result
    });

    logEvent('execution', intention.id, `Completed successfully`);

    // Move to completed directory
    archiveIntention(intention.id);

    return { success: true, result };
  } catch (error) {
    // Mark as failed
    updateIntention(intention.id, {
      state: 'failed',
      phase: 'evaluation',
      executionCompleted: new Date().toISOString(),
      error: error.message
    });

    logEvent('execution', intention.id, `Failed: ${error.message}`);

    return { success: false, error: error.message };
  }
}

/**
 * Archive completed intention
 */
function archiveIntention(id) {
  const sourcePath = path.join(INTENTIONS_DIR, `${id}.json`);
  const destPath = path.join(COMPLETED_DIR, `${id}.json`);

  if (fs.existsSync(sourcePath)) {
    fs.renameSync(sourcePath, destPath);
  }
}

// ============================================================================
// PHASE 5: OUTCOME EVALUATION (ASSESSMENT)
// ============================================================================

/**
 * Analyze prospective memory performance
 */
function evaluatePerformance(timeWindow = 86400000) { // Default: last 24 hours
  const completedFiles = fs.readdirSync(COMPLETED_DIR).filter(f => f.endsWith('.json'));
  const cutoff = Date.now() - timeWindow;

  const completed = completedFiles.map(f => {
    const content = fs.readFileSync(path.join(COMPLETED_DIR, f), 'utf8');
    return JSON.parse(content);
  }).filter(i => new Date(i.created).getTime() > cutoff);

  const successful = completed.filter(i => i.state === 'completed');
  const failed = completed.filter(i => i.state === 'failed');

  const stats = {
    total: completed.length,
    successful: successful.length,
    failed: failed.length,
    successRate: completed.length > 0 ? (successful.length / completed.length) : 0,
    byType: {
      event: completed.filter(i => i.triggerType === 'event').length,
      time: completed.filter(i => i.triggerType === 'time').length
    },
    byPriority: {
      high: completed.filter(i => i.priority === 'high').length,
      medium: completed.filter(i => i.priority === 'medium').length,
      low: completed.filter(i => i.priority === 'low').length
    }
  };

  return stats;
}

// ============================================================================
// MONITORING LOOP (FOR HEARTBEAT INTEGRATION)
// ============================================================================

/**
 * Main check function to be called periodically by heartbeat
 */
function checkIntentions(currentContext = {}) {
  const results = {
    eventBased: checkEventBasedIntentions(currentContext),
    timeBased: checkTimeBasedIntentions()
  };

  const triggered = [...results.eventBased, ...results.timeBased];

  if (triggered.length > 0) {
    console.log(`[PM] ${triggered.length} intention(s) triggered`);
    triggered.forEach(i => {
      console.log(`  - ${i.action} (${i.triggerType})`);
    });
  }

  return triggered;
}

// ============================================================================
// LOGGING
// ============================================================================

function logEvent(phase, intentionId, message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${phase}] ${intentionId}: ${message}\n`;

  const logFile = path.join(LOGS_DIR, `pm-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logEntry);

  console.log(`[PM] ${logEntry.trim()}`);
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'create':
      const action = process.argv[3];
      const triggerType = process.argv[4];
      const triggerSpec = process.argv[5];

      if (!action || !triggerType || !triggerSpec) {
        console.log('Usage: node prospective-memory.js create <action> <event|time> <trigger>');
        process.exit(1);
      }

      const intention = createIntention({ action, triggerType, triggerSpec });
      console.log(`Created intention: ${intention.id}`);
      console.log(JSON.stringify(intention, null, 2));
      break;

    case 'check':
      const context = process.argv[3] ? JSON.parse(process.argv[3]) : {};
      const triggered = checkIntentions(context);
      console.log(`Checked intentions, ${triggered.length} triggered`);
      break;

    case 'list':
      const active = loadActiveIntentions();
      console.log(`Active intentions: ${active.length}`);
      active.forEach(i => {
        console.log(`  - ${i.id}: ${i.action} (${i.triggerType}: ${i.triggerSpec})`);
      });
      break;

    case 'stats':
      const stats = evaluatePerformance();
      console.log('Prospective Memory Performance:');
      console.log(JSON.stringify(stats, null, 2));
      break;

    default:
      console.log('Usage:');
      console.log('  node prospective-memory.js create <action> <event|time> <trigger>');
      console.log('  node prospective-memory.js check [context_json]');
      console.log('  node prospective-memory.js list');
      console.log('  node prospective-memory.js stats');
      process.exit(1);
  }
}

module.exports = {
  createIntention,
  loadActiveIntentions,
  updateIntention,
  checkEventBasedIntentions,
  checkTimeBasedIntentions,
  executeIntention,
  evaluatePerformance,
  checkIntentions
};
