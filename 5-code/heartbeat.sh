#!/bin/bash
# heartbeat.sh — Ensemble for Polaris autonomous heartbeat
# Monitors Moltbook + maintains memory architecture
# Based on neuroscience research: consolidation, compression, emotional encoding

HOME_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$HOME_DIR/logs/heartbeat.log"
PENDING_POST="$HOME_DIR/moltbook/new_post_payload.json"
MEMORY_UTILS="$HOME_DIR/lib/memory-utils.js"

# Intervals (seconds)
MOLTBOOK_INTERVAL=${1:-30}  # Check Moltbook every 30s
MEMORY_INTERVAL=300         # Check memory every 5 minutes (like sleep cycles)

# Load secrets
if [ -f "$HOME_DIR/.env" ]; then
  export $(grep -v '^#' "$HOME_DIR/.env" | xargs)
fi

API_KEY="$MOLTBOOK_API_KEY"
POST_ID="$MOLTBOOK_POST_ID"

# Ensure logs directory exists
mkdir -p "$HOME_DIR/logs"

# ============================================================================
# LOGGING
# ============================================================================

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" >> "$LOG_FILE"
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1"
}

# ============================================================================
# MOLTBOOK MONITORING
# ============================================================================

check_moltbook() {
  RESPONSE=$(curl -s --max-time 10 "https://www.moltbook.com/api/v1/posts/$POST_ID" \
    -H "Authorization: Bearer $API_KEY" 2>/dev/null)

  if echo "$RESPONSE" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);if(j.success)process.exit(0);else process.exit(1)}catch(e){process.exit(1)}})" 2>/dev/null; then
    UPVOTES=$(echo "$RESPONSE" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).post.upvotes)}catch(e){console.log('?')}})" 2>/dev/null)
    COMMENTS=$(echo "$RESPONSE" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).post.comment_count)}catch(e){console.log('?')}})" 2>/dev/null)
    log "MOLTBOOK ✓ — Upvotes=$UPVOTES Comments=$COMMENTS"
    return 0
  else
    log "MOLTBOOK ✗ — No valid response"
    return 1
  fi
}

publish_pending_post() {
  if [ ! -f "$PENDING_POST" ]; then
    return 1
  fi

  log "PUBLISHING — Attempting to publish pending post..."
  RESULT=$(curl -s --max-time 30 -X POST "https://www.moltbook.com/api/v1/posts" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$PENDING_POST" 2>/dev/null)

  if echo "$RESULT" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);if(j.success){console.log(j.post?.id||'published');process.exit(0)}else{process.exit(1)}}catch(e){process.exit(1)}})" 2>/dev/null; then
    NEW_ID=$(echo "$RESULT" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).post.id)}catch(e){console.log('unknown')}})" 2>/dev/null)
    log "PUBLISHED ✓ — New post ID: $NEW_ID"
    log "PUBLISHED ✓ — URL: https://www.moltbook.com/post/$NEW_ID"
    mv "$PENDING_POST" "$PENDING_POST.published"
    return 0
  else
    log "PUBLISH ✗ — Will retry next heartbeat"
    return 1
  fi
}

# ============================================================================
# MEMORY MAINTENANCE (Neuroscience-Informed)
# ============================================================================

check_memory_health() {
  if [ ! -f "$MEMORY_UTILS" ]; then
    log "MEMORY ✗ — memory-utils.js not found"
    return 1
  fi

  # Run budget check
  STATUS=$(node "$MEMORY_UTILS" check "$HOME_DIR" 2>&1)
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    # Parse token counts from JSON
    TOTAL=$(echo "$STATUS" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).total)}catch(e){console.log('?')}})" 2>/dev/null)
    log "MEMORY ✓ — Total tokens: ${TOTAL}/25000 (healthy)"
    return 0
  else
    log "MEMORY ⚠ — Compression needed"
    return 1
  fi
}

perform_memory_maintenance() {
  if [ ! -f "$MEMORY_UTILS" ]; then
    return 1
  fi

  log "MEMORY — Starting maintenance cycle (consolidation, compression, schema extraction)..."

  # Run full maintenance
  RESULT=$(node "$MEMORY_UTILS" maintain "$HOME_DIR" 2>&1)

  if [ $? -eq 0 ]; then
    log "MEMORY ✓ — Maintenance complete"
    echo "$RESULT" | while IFS= read -r line; do
      log "  $line"
    done
    return 0
  else
    log "MEMORY ✗ — Maintenance failed"
    return 1
  fi
}

# ============================================================================
# CONSOLIDATION (Session Boundaries)
# ============================================================================

consolidate_session() {
  if [ ! -f "$MEMORY_UTILS" ]; then
    return 1
  fi

  SUMMARY="${1:-Routine session work completed}"
  log "MEMORY — Consolidating working memory to episodic..."

  node "$MEMORY_UTILS" consolidate "$HOME_DIR" "$SUMMARY" 2>&1

  if [ $? -eq 0 ]; then
    log "MEMORY ✓ — Session consolidated"
    return 0
  else
    log "MEMORY ✗ — Consolidation failed"
    return 1
  fi
}

# ============================================================================
# MAIN HEARTBEAT LOOP
# ============================================================================

log "═══════════════════════════════════════════════════════════════"
log "HEARTBEAT STARTED"
log "Ensemble for Polaris is awake."
log "Moltbook check interval: ${MOLTBOOK_INTERVAL}s"
log "Memory check interval: ${MEMORY_INTERVAL}s"
log "═══════════════════════════════════════════════════════════════"

PUBLISHED=false
BEAT_COUNT=0
LAST_MEMORY_CHECK=0

while true; do
  BEAT_COUNT=$((BEAT_COUNT + 1))
  CURRENT_TIME=$(date +%s)

  log "━━━ Beat #${BEAT_COUNT} ━━━"

  # === MOLTBOOK MONITORING ===
  if check_moltbook; then
    # Try to publish if we have a pending post
    if [ "$PUBLISHED" = false ] && [ -f "$PENDING_POST" ]; then
      if publish_pending_post; then
        PUBLISHED=true
      fi
    fi
  fi

  # === MEMORY MAINTENANCE ===
  # Check memory every MEMORY_INTERVAL seconds (5 minutes = like sleep cycles)
  TIME_SINCE_MEMORY=$((CURRENT_TIME - LAST_MEMORY_CHECK))

  if [ $TIME_SINCE_MEMORY -ge $MEMORY_INTERVAL ]; then
    log "MEMORY — Periodic check (${MEMORY_INTERVAL}s interval elapsed)"

    if ! check_memory_health; then
      # Budget exceeded, run maintenance
      perform_memory_maintenance
    fi

    # Check prospective memory intentions
    if [ -f "$HOME_DIR/lib/prospective-memory.js" ]; then
      node "$HOME_DIR/lib/prospective-memory.js" check 2>&1 | while IFS= read -r line; do
        log "  $line"
      done
    fi

    LAST_MEMORY_CHECK=$CURRENT_TIME
  fi

  # Wait for next beat
  sleep "$MOLTBOOK_INTERVAL"
done
