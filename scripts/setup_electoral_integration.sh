Project_Dhruv/scripts/setup_electoral_integration.sh
#!/bin/bash

# Setup Script for Chhattisgarh Electoral Data Integration
# This script helps set up the Mapbox token and runs the electoral enhancement

set -e

echo "🔧 Chhattisgarh Electoral Data Integration Setup"
echo "=============================================="

# Check if Mapbox token is set
if [ -z "$MAPBOX_ACCESS_TOKEN" ]; then
    echo "❌ MAPBOX_ACCESS_TOKEN environment variable not set"
    echo ""
    echo "📝 To get a free Mapbox token:"
    echo "1. Go to https://account.mapbox.com/access-tokens/"
    echo "2. Sign up for a free account"
    echo "3. Create a new access token"
    echo "4. Set the environment variable:"
    echo "   export MAPBOX_ACCESS_TOKEN=your_token_here"
    echo ""
    echo "Or run this script with the token:"
    echo "   MAPBOX_ACCESS_TOKEN=your_token ./setup_electoral_integration.sh"
    exit 1
fi

echo "✅ Mapbox token found"

# Check if input file exists
INPUT_FILE="scripts/test.ndjson"
if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ Input file not found: $INPUT_FILE"
    echo "Please ensure the Chhattisgarh village dataset exists"
    exit 1
fi

echo "✅ Input dataset found: $INPUT_FILE"

# Create output directory if needed
OUTPUT_DIR="data"
mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="$OUTPUT_DIR/chhattisgarh_villages_with_electoral.ndjson"

echo "🚀 Starting electoral data enhancement..."
echo "   Input:  $INPUT_FILE"
echo "   Output: $OUTPUT_FILE"
echo ""

# Run the enhancement script
python3 scripts/enhance_chhattisgarh_with_electoral_data.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Enhancement completed successfully!"
    echo "📊 Enhanced dataset saved to: $OUTPUT_FILE"
    echo ""
    echo "📈 Dataset Statistics:"

    # Show some basic stats
    VILLAGE_COUNT=$(grep -c '"name"' "$OUTPUT_FILE" || echo "0")
    ASSEMBLY_COUNT=$(grep -c '"assembly_constituency"' "$OUTPUT_FILE" || echo "0")
    PARLIAMENT_COUNT=$(grep -c '"parliamentary_constituency"' "$OUTPUT_FILE" || echo "0")

    echo "   Villages processed: $VILLAGE_COUNT"
    echo "   Assembly constituencies found: $ASSEMBLY_COUNT"
    echo "   Parliamentary constituencies found: $PARLIAMENT_COUNT"

    echo ""
    echo "🔍 Next steps:"
    echo "1. Review the enhanced dataset"
    echo "2. Validate constituency mappings"
    echo "3. Consider integrating with official census data"
    echo "4. Update documentation"

else
    echo ""
    echo "❌ Enhancement failed. Check the logs above for details."
    exit 1
fi
