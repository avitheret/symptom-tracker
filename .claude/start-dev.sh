#!/bin/bash
export HOME="/Users/avi"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd /Users/avi/Library/CloudStorage/Dropbox/claude/symptom-tracker || exit 1
exec /opt/homebrew/bin/node node_modules/vite/bin/vite.js --port 5173
