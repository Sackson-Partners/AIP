#!/bin/bash

# Script to replace console.log/error/warn with structured logger
# Usage: ./migrate-console-logs.sh

set -e

echo "🔄 Migrating console statements to structured logger..."
echo ""

# Counter
MODIFIED=0

# Find all TypeScript files in src/app/api
find src/app/api -name "*.ts" -type f | while read -r file; do
  # Check if file has console statements
  if grep -q "console\.\(log\|error\|warn\|info\)" "$file"; then
    echo "📝 Processing: $file"

    # Check if logger is already imported
    if ! grep -q "import.*logger.*from.*@/lib/logger" "$file"; then
      # Add logger import after other imports
      sed -i.bak '/^import/a\
import { logger } from '"'"'@/lib/logger'"'"'
' "$file"
      echo "   ✅ Added logger import"
    fi

    # Replace common patterns (preserving error objects)
    # Pattern 1: console.error('[...]', error)
    sed -i.bak -E "s/console\.error\('([^']+)', error\)/logger.error('\1', error)/g" "$file"
    sed -i.bak -E 's/console\.error\("([^"]+)", error\)/logger.error("\1", error)/g' "$file"

    # Pattern 2: console.error with template literals
    sed -i.bak -E "s/console\.error\(\`([^\`]+)\`, error\)/logger.error('\1', error)/g" "$file"

    # Pattern 3: console.log
    sed -i.bak -E "s/console\.log\('([^']+)'\)/logger.info('\1')/g" "$file"
    sed -i.bak -E 's/console\.log\("([^"]+)"\)/logger.info("\1")/g' "$file"

    # Pattern 4: console.warn
    sed -i.bak -E "s/console\.warn\('([^']+)'\)/logger.warn('\1')/g" "$file"
    sed -i.bak -E 's/console\.warn\("([^"]+)"\)/logger.warn("\1")/g' "$file"

    # Remove backup file
    rm -f "$file.bak"

    MODIFIED=$((MODIFIED + 1))
  fi
done

echo ""
echo "✅ Migration complete!"
echo "📊 Modified files: $MODIFIED"
echo ""
echo "⚠️  IMPORTANT: Review changes before committing!"
echo "   - Some console statements may need manual context adjustment"
echo "   - Check for duplicate logger imports"
echo "   - Run tests: npm test"
