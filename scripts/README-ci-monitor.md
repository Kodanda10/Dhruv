# CI Monitor for Ironclad CI

A continuous CI monitoring script that runs in the background and provides real-time status updates with notifications.

## Features

- 🚀 **Real-time Monitoring**: Checks CI status every 30 seconds
- 🎨 **Color-coded Status**: Green for success, red for failure, blue for running
- 📢 **Smart Notifications**: Only notifies on status changes (red → green, green → red, etc.)
- 📋 **Detailed Job Status**: Shows individual job statuses in verbose mode
- 🔔 **System Notifications**: Sends macOS notifications when status changes
- ⏹️ **Clean Exit**: Graceful shutdown with Ctrl+C

## Usage

### Quick Start
```bash
npm run ci:monitor
```

### Direct Script Execution
```bash
./scripts/ci-monitor.sh
```

### Background Monitoring
```bash
./scripts/ci-monitor.sh &
```

## Configuration

The script can be customized by editing the configuration variables at the top of `ci-monitor.sh`:

```bash
INTERVAL=30           # Check every 30 seconds
NOTIFICATION_ENABLED=true  # Enable/disable notifications
VERBOSE=true         # Show detailed job information
```

## Status Indicators

- ✅ **All Green**: All CI checks passed successfully
- ❌ **Failed**: One or more CI checks failed
- ⏳ **Running**: CI is currently in progress
- ❓ **Unknown**: Unable to determine status
- 📭 **No Runs**: No CI runs found

## Prerequisites

- GitHub CLI (`gh`) must be installed and authenticated
- Must be run from within a git repository
- Repository must have the `ironclad.yml` workflow

## Notifications

The script automatically sends notifications when CI status changes:

- **Success**: "CI is now all green! ✅"
- **Failure**: "CI has failed! ❌ Check the details above."
- **Started**: "CI run has started"

On macOS, notifications use the system notification center if `terminal-notifier` is available.

## Example Output

```
🚀 Starting CI Monitor for Ironclad CI
Checking status every 30 seconds...
Press Ctrl+C to stop monitoring

11:12:55 CI Status: ⏳ Running (Run ID: 17540952292)
Job Details:
  lint-type: completed (success)
  unit-tests: in_progress (null)
  api-tests: pending (null)
  coverage-gate: pending (null)
  security: pending (null)
  licenses-sbom: pending (null)
  web-a11y-perf: pending (null)
  perf-k6: pending (null)
  e2e-smoke: pending (null)
  iac-validate: pending (null)
  audit-trail: pending (null)

11:13:25 CI Status: ❌ Failed (Run ID: 17540952292)
Failed Jobs:
  unit-tests: completed (failure)

11:13:25 NOTIFICATION: CI Status: Failed - CI has failed! ❌ Check the details above.
```

## Troubleshooting

### GitHub CLI Not Found
```bash
# Install GitHub CLI
brew install gh
gh auth login
```

### No Repository Access
```bash
# Ensure you're authenticated and in the correct repository
gh auth status
git remote -v
```

### No CI Runs Found
- Check that the repository has the `ironclad.yml` workflow
- Ensure CI has been triggered at least once
- Verify the workflow file exists in `.github/workflows/ironclad.yml`

## Integration with Development Workflow

Add to your development scripts in `package.json`:

```json
{
  "scripts": {
    "ci:monitor": "./scripts/ci-monitor.sh",
    "dev:ci": "npm run dev & npm run ci:monitor"
  }
}
```

This allows you to monitor CI while developing locally.
