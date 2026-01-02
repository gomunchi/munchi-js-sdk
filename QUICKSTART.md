# Quick Start for Internal Developers

Welcome! This guide will help you install and use the Munchi JS SDK in your projects.

## Installation

### Step 1: Ensure GitHub Access

Make sure you have:
- ✅ Access to the `gomunchi` GitHub organization
- ✅ SSH key set up with GitHub (test with: `ssh -T git@github.com`)

### Step 2: Install Packages

Add to your `package.json`:

```json
{
  "dependencies": {
    "@munchi/core": "github:gomunchi/munchi-js-sdk#core",
    "@munchi/payments": "github:gomunchi/munchi-js-sdk#payments"
  }
}
```

Then run:
```bash
npm install
# or
pnpm install
```

**Note:** The first install will take a bit longer as it builds the packages automatically.

## Usage

### Import and Use

```typescript
// Import from @munchi/core
import { MUNCHI_CORE_VERSION } from '@munchi/core';

console.log('Core version:', MUNCHI_CORE_VERSION);

// Import from @munchi/payments
import { /* your exports */ } from '@munchi/payments';
```

### TypeScript Support

Full TypeScript support is included! You'll get:
- ✅ Auto-completion in your IDE
- ✅ Type checking
- ✅ IntelliSense documentation

## Installing Specific Versions

To install a specific version (once tags are created):

```json
{
  "dependencies": {
    "@munchi/core": "github:gomunchi/munchi-js-sdk#core-v1.0.0",
    "@munchi/payments": "github:gomunchi/munchi-js-sdk#payments-v1.0.0"
  }
}
```

## Updating Packages

To update to the latest version:

```bash
npm update @munchi/core @munchi/payments
# or
pnpm update @munchi/core @munchi/payments
```

Or reinstall:
```bash
npm install github:gomunchi/munchi-js-sdk#core
npm install github:gomunchi/munchi-js-sdk#payments
```

## CI/CD Setup

### GitHub Actions

Add this to your workflow to authenticate:

```yaml
- name: Configure Git for Private Repos
  run: |
    git config --global url."https://x-access-token:${{ secrets.GITHUB_TOKEN }}@github.com/".insteadOf "https://github.com/"

- name: Install Dependencies
  run: npm install
```

The `GITHUB_TOKEN` is automatically available in GitHub Actions.

### Other CI Systems

If using other CI systems (GitLab CI, CircleCI, etc.):

1. Create a GitHub Personal Access Token with `repo` scope
2. Add it as a secret in your CI system
3. Configure git before installing:

```bash
git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
npm install
```

## Troubleshooting

### "Repository not found"

**Solution:** Ensure you have access to the `gomunchi` organization and the repository.

```bash
# Test access
git ls-remote git@github.com:gomunchi/munchi-js-sdk.git
```

### "Failed to prepare package"

**Solution:** This usually means the build failed. Check:
- Node.js version is 18 or higher
- All build dependencies are available

### Slow Installation

**First install is slower** because packages are built from source. Subsequent installs will be faster due to caching.

## Available Packages

### @munchi/core
Core utilities and types for Munchi services.

**Size:** ~800 KB  
**Dependencies:** dayjs

### @munchi/payments
Payment processing utilities.

**Size:** ~11 KB  
**Dependencies:** @munchi/core, dayjs  
**Peer Dependencies:** axios >= 1.0.0

## Need Help?

- 📖 Check the [main README](./README.md)
- 📚 See [detailed installation guide](./GITHUB_INSTALL.md)
- 💬 Ask in the team chat
- 🐛 Report issues in the repository

## Example Project

Here's a complete example `package.json`:

```json
{
  "name": "my-munchi-app",
  "version": "1.0.0",
  "dependencies": {
    "@munchi/core": "github:gomunchi/munchi-js-sdk#core",
    "@munchi/payments": "github:gomunchi/munchi-js-sdk#payments",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

Happy coding! 🚀
