#!/bin/bash
# Setup environment variables for Twitter API

echo "=========================================="
echo "Twitter API Setup Helper"
echo "=========================================="
echo ""

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Copy from example
cp .env.example .env.local

echo "✅ Created .env.local from template"
echo ""
echo "Please add your Twitter API credentials to .env.local:"
echo ""
echo "Required fields:"
echo "  1. X_API_KEY"
echo "  2. X_API_SECRET"
echo "  3. X_BEARER_TOKEN"
echo "  4. X_ACCESS_TOKEN"
echo "  5. X_ACCESS_TOKEN_SECRET"
echo ""
echo "Get these from: https://developer.twitter.com/en/portal/dashboard"
echo ""
echo "After adding credentials, run:"
echo "  npm test -- tests/twitter-api-setup.test.ts"
echo ""

