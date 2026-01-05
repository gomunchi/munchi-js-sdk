# Munchi JS SDK

TypeScript SDK for Munchi services, providing core utilities and payment processing.

## Packages

- **[@munchi/core](./core)** - Core utilities and types
- **[@munchi/payments](./payments)** - Payment processing utilities

## Installation

✨ **No authentication required!** This is a public repository.

### Quick Install

```bash
# Install both packages
npm install github:gomunchi/munchi-js-sdk#core github:gomunchi/munchi-js-sdk#payments

# Or with pnpm
pnpm add github:gomunchi/munchi-js-sdk#core github:gomunchi/munchi-js-sdk#payments
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

Then simply run `npm install` - no authentication setup needed!

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

**Note:** Direct pushes to `main` are blocked. All changes must go through pull requests.

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
