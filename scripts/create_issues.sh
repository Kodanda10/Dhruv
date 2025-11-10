#!/bin/bash
# This script reads the PRD and creates a GitHub issue for each atomic task.
# It requires the GitHub CLI ('gh') to be installed and authenticated.

PRD_FILE=".agent-policy/PRD_Dhruv_Dashboard.markdown"

# Check if gh is installed
if ! command -v gh &> /dev/null
then
    echo "GitHub CLI (gh) could not be found. Please install it to continue."
    echo "See: https://cli.github.com/"
    exit 1
fi

# Check if user is logged in to gh
if ! gh auth status &> /dev/null
then
    echo "You are not logged in to the GitHub CLI. Please run 'gh auth login'."
    exit 1
fi

echo "Reading tasks from $PRD_FILE..."

# Find all lines starting with "X. **Task XX: " and create an issue for each
grep -E "^[0-9]+\.\s\*\*Task [0-9]+:" "$PRD_FILE" | while read -r line ; do
    # Extract the title from the markdown line
    title=$(echo "$line" | sed -E 's/^[0-9]+\. \*\*Task [0-9]+: (.*)\*\*/\1/')
    
    echo "Creating issue for: $title"
    
    # Create the issue in GitHub and add the "Task" label
    gh issue create --title "$title" --body "This task was automatically generated from the PRD." --label "Task"
done

echo "All tasks have been created as issues."
