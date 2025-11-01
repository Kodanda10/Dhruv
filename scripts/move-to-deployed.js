#!/usr/bin/env node
/*
 Moves closed Task issues into the "Deployed" status on a Projects (v2) board.

 Requirements:
 - Env GH_TOKEN with a token that has 'project' read/write scopes (classic) or equivalent fine-grained project write.
 - Env PROJECT_OWNER (e.g. "Pinak-Setu")
 - Env PROJECT_NUMBER (e.g. "4")
 - Optional: ISSUE_LABEL (default: "Task")

 This script intentionally keeps logic simple and idempotent:
 - For each closed issue with the label, ensure it's added to the project
 - Update the project's single-select Status field to "Deployed"
*/

const { execFileSync } = require('child_process');

function runGh(args, input) {
  const env = { ...process.env };
  const result = execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result;
}

function ghGraphql(query, variables = {}) {
  const args = ['api', 'graphql', '-f', `query=${query}`, '-f', `variables=${JSON.stringify(variables)}`];
  const out = runGh(args);
  return JSON.parse(out);
}

function ensureEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function getClosedTaskIssues(label) {
  const fields = 'id,number,title,closedAt';
  const args = ['issue', 'list', '--state', 'closed', '--label', label, '--json', fields];
  const out = runGh(args);
  return JSON.parse(out);
}

function getProject(owner, number) {
  const q = `query($owner: String!, $number: Int!) {
    user(login: $owner) {
      projectV2(number: $number) {
        id
        fields(first: 50) {
          nodes {
            ... on ProjectV2SingleSelectField { id name options { id name } }
          }
        }
      }
    }
  }`;
  const data = ghGraphql(q, { owner, number: Number(number) });
  if (!data.user || !data.user.projectV2) {
    throw new Error('Project not found or token lacks read:project');
  }
  return data.user.projectV2;
}

function addIssueToProject(projectId, issueNodeId) {
  const q = `mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
      item { id }
    }
  }`;
  try {
    const res = ghGraphql(q, { projectId, contentId: issueNodeId });
    return res.addProjectV2ItemById.item.id;
  } catch (e) {
    // If already exists, we'll fetch via node() lookup next
    return null;
  }
}

function getProjectItemIdForIssue(projectId, issueNodeId) {
  const q = `query($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        projectItems(first: 50) {
          nodes { id project { id } }
        }
      }
    }
  }`;
  const data = ghGraphql(q, { issueId: issueNodeId });
  const items = data.node?.projectItems?.nodes || [];
  const found = items.find((n) => n.project?.id === projectId);
  return found?.id || null;
}

function updateStatus(projectId, itemId, fieldId, optionId) {
  const q = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId,
      itemId: $itemId,
      fieldId: $fieldId,
      value: { singleSelectOptionId: $optionId }
    }) { projectV2Item { id } }
  }`;
  ghGraphql(q, { projectId, itemId, fieldId, optionId });
}

function main() {
  // Validate env
  ensureEnv('GH_TOKEN'); // ensure token present
  const owner = ensureEnv('PROJECT_OWNER');
  const number = ensureEnv('PROJECT_NUMBER');
  const label = process.env.ISSUE_LABEL || 'Task';

  console.log(`Synchronizing closed '${label}' issues to 'Deployed' on ${owner}/projects/${number} ...`);

  // Discover project + Status field + "Deployed" option
  const project = getProject(owner, number);
  const projectId = project.id;
  const statusField = (project.fields.nodes || []).find((f) => f && f.name === 'Status');
  if (!statusField) {
    throw new Error('Status field not found on project. Please add a single-select field named "Status".');
  }
  const deployedOption = (statusField.options || []).find((o) => o.name === 'Deployed');
  if (!deployedOption) {
    throw new Error('"Deployed" option not found in Status field. Please add it to the project.');
  }

  const issues = getClosedTaskIssues(label);
  if (!issues.length) {
    console.log('No closed issues found. Nothing to do.');
    return;
  }

  let moved = 0;
  for (const issue of issues) {
    const issueNodeId = issue.id; // GraphQL node id
    // Ensure the issue is an item on the project
    let itemId = addIssueToProject(projectId, issueNodeId);
    if (!itemId) {
      itemId = getProjectItemIdForIssue(projectId, issueNodeId);
    }
    if (!itemId) {
      console.warn(`Could not determine project item for issue #${issue.number}`);
      continue;
    }
    // Update its Status to Deployed
    updateStatus(projectId, itemId, statusField.id, deployedOption.id);
    console.log(`Moved #${issue.number} → Deployed`);
    moved += 1;
  }

  console.log(`Done. Updated ${moved} issues.`);
}

try {
  main();
} catch (err) {
  console.error('Failed to update project board:', err?.message || err);
  process.exit(1);
}


