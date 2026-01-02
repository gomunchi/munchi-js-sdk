# GitHub Installation Guide

This guide explains how to install and use the `@munchi` packages directly from GitHub without npm.

## Prerequisites

- Git installed
- Access to the GitHub repository (organization members)
- Node.js and npm/pnpm installed

## Installation Methods

### Method 1: Install from GitHub URL (Recommended)

Install packages directly from GitHub using the repository URL:

```bash
# Install @munchi/core
npm install github:gomunchi/munchi-js-sdk#core

# Install @munchi/payments
npm install github:gomunchi/munchi-js-sdk#payments
```

Or with pnpm:
```bash
pnpm add github:gomunchi/munchi-js-sdk#core
pnpm add github:gomunchi/munchi-js-sdk#payments
```

### Method 2: Install from Git URL

```bash
# Using HTTPS
npm install git+https://github.com/gomunchi/munchi-js-sdk.git#core
npm install git+https://github.com/gomunchi/munchi-js-sdk.git#payments

# Using SSH (recommended for private repos)
npm install git+ssh://git@github.com/gomunchi/munchi-js-sdk.git#core
npm install git+ssh://git@github.com/gomunchi/munchi-js-sdk.git#payments
```

### Method 3: Install Specific Version/Tag

```bash
# Install specific tag
npm install github:gomunchi/munchi-js-sdk#v1.0.0

# Install specific commit
npm install github:gomunchi/munchi-js-sdk#abc1234

# Install specific branch
npm install github:gomunchi/munchi-js-sdk#main
```

## Package.json Configuration

Add to your `package.json`:

```json
{
  "dependencies": {
    "@munchi/core": "github:gomunchi/munchi-js-sdk#core",
    "@munchi/payments": "github:gomunchi/munchi-js-sdk#payments"
  }
}
```

Or with version tags:
```json
{
  "dependencies": {
    "@munchi/core": "github:gomunchi/munchi-js-sdk#core-v1.0.0",
    "@munchi/payments": "github:gomunchi/munchi-js-sdk#payments-v1.0.0"
  }
}
```

## Authentication for Private Repositories

### Option 1: SSH Key (Recommended)
1. Set up SSH key with GitHub: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
2. Use SSH URLs: `git+ssh://git@github.com/gomunchi/munchi-js-sdk.git#core`

### Option 2: Personal Access Token
1. Create a GitHub Personal Access Token with `repo` scope
2. Configure git credentials:
   ```bash
   git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
   ```

### Option 3: .npmrc with GitHub Token
Create `.npmrc` in your project:
```
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## Usage in Your Project

After installation, import as usual:

```typescript
// Import from @munchi/core
import { MUNCHI_CORE_VERSION } from '@munchi/core';

// Import from @munchi/payments
import { /* your exports */ } from '@munchi/payments';
```

## Updating Packages

```bash
# Update to latest commit on branch
npm update @munchi/core
npm update @munchi/payments

# Or reinstall
npm install github:gomunchi/munchi-js-sdk#core
npm install github:gomunchi/munchi-js-sdk#payments
```

## Version Management with Git Tags

To enable version-specific installations, create git tags:

```bash
# Tag core package
git tag core-v1.0.0
git push origin core-v1.0.0

# Tag payments package
git tag payments-v1.0.0
git push origin payments-v1.0.0
```

Then install specific versions:
```bash
npm install github:gomunchi/munchi-js-sdk#core-v1.0.0
npm install github:gomunchi/munchi-js-sdk#payments-v1.0.0
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Install Dependencies

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      # Option 1: Use GITHUB_TOKEN (automatic)
      - name: Configure Git
        run: |
          git config --global url."https://x-access-token:${{ secrets.GITHUB_TOKEN }}@github.com/".insteadOf "https://github.com/"
      
      - run: npm install
      
      # Option 2: Use SSH (requires SSH key in secrets)
      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
      
      - run: npm install
```

## Troubleshooting

### Error: "Repository not found"
- Ensure you have access to the repository
- Check if using SSH: Verify SSH key is set up
- Check if using HTTPS: Verify GitHub token has correct permissions

### Error: "Failed to prepare package"
- The package may not have a `prepare` or `prepublishOnly` script
- Ensure the repository has the built files committed OR has build scripts

### Slow Installation
- GitHub installations can be slower than npm
- Consider using a package cache in CI/CD

## Advantages of GitHub Installation

✅ **Free** - No npm subscription required
✅ **Private** - Only organization members can access
✅ **Version Control** - Use git tags for versioning
✅ **Direct Access** - No need for npm registry
✅ **Monorepo Support** - Multiple packages in one repo

## Disadvantages

❌ Slower installation than npm
❌ Requires git access/authentication
❌ No automatic dependency resolution across versions
❌ Requires build artifacts in repository OR build on install

## Best Practices

1. **Commit build artifacts** (`dist/` folder) to make installation faster
2. **Use git tags** for version management
3. **Use SSH** for authentication in development
4. **Use tokens** for CI/CD
5. **Document versions** in CHANGELOG.md
6. **Test installations** before tagging releases

## Example Project Setup

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "@munchi/core": "github:gomunchi/munchi-js-sdk#core-v1.0.0",
    "@munchi/payments": "github:gomunchi/munchi-js-sdk#payments-v1.0.0",
    "axios": "^1.6.0"
  }
}
```

## Need Help?

- Check repository access permissions
- Verify git authentication is working: `git ls-remote git@github.com:gomunchi/munchi-js-sdk.git`
- Review GitHub documentation: https://docs.github.com/en/packages
