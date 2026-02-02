# Munchi JS SDK

TypeScript SDK for Munchi services, providing core utilities and payment processing.

## Packages

- **[@munchi/core](./core)** - Core utilities and types
- **[@munchi/payments](./payments)** - Payment processing utilities

## Installation

✨ **No authentication required!** This is a public repository.

### Quick Install (Latest Stable)

We recommend using a specific version tag to ensure stability. The current stable version is `v1.1.0`.

```bash
# npm
npm install github:gomunchi/munchi-js-sdk#v1.1.0

# pnpm
pnpm add github:gomunchi/munchi-js-sdk#v1.1.0
```

> [!TIP]
> Always use a version tag (e.g., `#v1.1.0`) instead of `#master` in production. This ensures your build remains the same even when newer versions are released.

### In your package.json

```json
{
  "dependencies": {
    "@munchi/sdk": "github:gomunchi/munchi-js-sdk#v1.1.0"
  }
}
```

Then run `npm install` or `pnpm install` - no authentication setup needed!

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

This monorepo uses a centralized version system with an automated release script.

### Creating a Release

```bash
# Release with version bump only
./scripts/release.sh 1.0.13

# Release and create GitHub release with auto-generated notes
./scripts/release.sh 1.0.13 --publish

# Release with custom release notes (opens editor)
./scripts/release.sh 1.0.13 --publish=custom
```

The script will:
1. Update version in all `package.json` files and `version.ts`
2. Build all packages
3. Commit changes and create git tags
4. Push to remote
5. (Optional) Create a GitHub release

### Git Tags

Each release creates three tags:
- `v1.1.0` - Main version tag (use this for installing)
- `core-v1.1.0` - Core package tag
- `payments-v1.1.0` - Payments package tag
- `react-v1.1.0` - React package tag

### Install Specific Version

```bash
# npm
npm install github:gomunchi/munchi-js-sdk#v1.1.0

# pnpm
pnpm add github:gomunchi/munchi-js-sdk#v1.1.0
```

## Contributing

This repository is public but protected with branch protection rules.

### Development Workflow

1. **Clone the repository**
   ```bash
   git clone https://github.com/gomunchi/munchi-js-sdk.git
   cd munchi-js-sdk
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes and commit**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

4. **Push to your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**
   - Go to GitHub
   - Click "Compare & pull request"
   - Add description and request review
   - Wait for approval and merge

**Note:** Direct pushes to `master` are blocked. All changes must go through pull requests.

See **[Branch Protection Guide](./BRANCH_PROTECTION.md)** for details.

## Documentation

- **[Public Installation Guide](./PUBLIC_INSTALL.md)** - Simple installation without authentication
- **[Branch Protection Guide](./BRANCH_PROTECTION.md)** - How to contribute with branch protection
- **[Quick Start](./QUICKSTART.md)** - Get started quickly
- **[GitHub Installation Guide](./GITHUB_INSTALL.md)** - Alternative installation methods (legacy)
- **[Deployment Guide](./DEPLOYMENT.md)** - npm publishing guide (if needed in future)

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

### `pnpm` Caching Issues (Stale Code)
When installing via GitHub URL, `pnpm` heavily caches the repository content. If you update the version tag in `package.json` but still see old code:
1. Run `pnpm install --force`
2. If that fails, run `pnpm store prune` and try again.
3. As a last resort, delete `node_modules` and the lockfile.

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
