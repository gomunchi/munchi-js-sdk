# Munchi JS SDK

TypeScript SDK for Munchi services, providing core utilities and payment processing.

## Packages

- **[@munchi/core](./core)** - Core utilities and types
- **[@munchi/payments](./payments)** - Payment processing utilities

## Installation

### Install from GitHub (Recommended for Organization Members)

```bash
# Install both packages
npm install github:gomunchi/munchi-js-sdk#core
npm install github:gomunchi/munchi-js-sdk#payments

# Or with pnpm
pnpm add github:gomunchi/munchi-js-sdk#core
pnpm add github:gomunchi/munchi-js-sdk#payments
```

### In your package.json

```json
{
  "dependencies": {
    "@munchi/core": "github:gomunchi/munchi-js-sdk#core",
    "@munchi/payments": "github:gomunchi/munchi-js-sdk#payments"
  }
}
```

> **Note:** Replace `gomunchi` with your actual GitHub organization name.

## Quick Start

```typescript
// Import from @munchi/core
import { MUNCHI_CORE_VERSION } from '@munchi/core';

console.log('Core version:', MUNCHI_CORE_VERSION);

// Import from @munchi/payments
import { /* your exports */ } from '@munchi/payments';
```

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm -r build

# Watch mode for development
cd core && pnpm dev
# or
cd payments && pnpm dev
```

### Project Structure

```
munchi-js-sdk/
├── core/              # Core utilities package
│   ├── src/
│   ├── generated/
│   ├── dist/          # Built files (generated)
│   └── package.json
├── payments/          # Payments package
│   ├── src/
│   ├── dist/          # Built files (generated)
│   └── package.json
└── package.json       # Root workspace config
```

## Version Management

This monorepo uses a centralized version system. The version is defined in `version.ts` and automatically synced to all packages.

### Update Version

1. Edit `version.ts` in the root
2. Run build to sync versions: `pnpm -r build`

### Git Tags for Versioning

Create tags for specific versions:

```bash
# Tag a release
git tag core-v1.0.0
git tag payments-v1.0.0
git push origin --tags

# Install specific version
npm install github:gomunchi/munchi-js-sdk#core-v1.0.0
```

## Authentication

### For Private Repositories

#### Option 1: SSH (Recommended for Development)
```bash
# Ensure SSH key is set up with GitHub
ssh -T git@github.com

# Install using SSH
npm install git+ssh://git@github.com/gomunchi/munchi-js-sdk.git#core
```

#### Option 2: Personal Access Token (CI/CD)
```bash
# Set up git credentials
git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"

# Install normally
npm install github:gomunchi/munchi-js-sdk#core
```

## Documentation

- **[GitHub Installation Guide](./GITHUB_INSTALL.md)** - Detailed guide for installing from GitHub
- **[Deployment Guide](./DEPLOYMENT.md)** - npm publishing guide (if needed in future)
- **[Quick Publish Reference](./PUBLISH.md)** - Quick reference for publishing

## Features

✅ **TypeScript** - Full type safety
✅ **Dual Format** - CommonJS and ESM support  
✅ **Tree Shakeable** - Optimized bundle size
✅ **Source Maps** - Easy debugging
✅ **Type Declarations** - Full IntelliSense support
✅ **Monorepo** - Multiple packages in one repository
✅ **Auto Build** - Builds automatically on install from GitHub

## CI/CD

See [GITHUB_INSTALL.md](./GITHUB_INSTALL.md#cicd-integration) for GitHub Actions examples.

## Troubleshooting

### Installation fails with "Repository not found"
- Verify you have access to the repository
- Check your GitHub authentication (SSH key or token)

### Build fails on install
- Ensure you have the required devDependencies installed
- Check that Node.js version is 18+

### Types not working
- Ensure TypeScript is installed in your project
- Check that `@types/node` is installed if needed

## License

UNLICENSED - Private package for organization use only.

## Support

For issues or questions, please contact the development team or create an issue in the repository.
