#!/bin/bash
# This script reads the PRD and creates a GitHub issue for each atomic task.

PRD_FILE=".agent-policy/PRD_Dhruv_Dashboard.markdown"

echo "Reading tasks from $PRD_FILE..."

# Find all lines starting with "X. **Task XX: " and create an issue for each
grep -E "^[0-9]+\.\s\*\*Task [0-9]+:" "$PRD_FILE" | while read -r line ; do
    # Extract the title from the markdown line
    title=$(echo "$line" | sed -E 's/^[0-9]+\. \*\*Task [0-9]+: (.*)\*\*/\1/')
    
    echo "Creating issue for: $title"
    
    # Create the issue in GitHub without a label
    gh issue create --title "$title" --body "This task was automatically generated from the PRD."
done

echo "All tasks have been created as issues."
