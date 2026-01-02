# Quick Publish Guide

## First Time Setup

### Option 1: Publishing to npm Registry
```bash
# 1. Update .npmrc to use npm registry
echo '@munchi:registry=https://registry.npmjs.org/' > .npmrc

# 2. Login to npm
npm login

# 3. Verify login
npm whoami
```

### Option 2: Keep GitHub Packages (current setup)
```bash
# 1. Login to GitHub Packages
npm login --registry=https://npm.pkg.github.com

# Username: your-github-username
# Password: your-github-personal-access-token (with write:packages scope)
# Email: your-github-email
```

## Publishing Workflow

### 1. Build and Test
```bash
# Build all packages
pnpm -r build

# Verify what will be published
cd core && npm pack --dry-run
cd ../payments && npm pack --dry-run
```

### 2. Update Version (if needed)
```bash
# In core/
npm version patch  # or minor, or major

# In payments/
npm version patch  # or minor, or major
```

### 3. Publish
```bash
# Publish core first (payments depends on it)
cd core
npm publish

# Then publish payments
cd ../payments
npm publish
```

## Quick Commands

```bash
# Check what files will be included
npm pack --dry-run

# Check if logged in
npm whoami

# View published package
npm view @munchi/core

# Test installation locally
npm link
```

## Current Configuration

- ✅ Packages configured for **private** publishing (`access: restricted`)
- ✅ Auto-build before publish (`prepublishOnly` script)
- ✅ Version sync from root `version.ts`
- ✅ TypeScript declarations included
- ✅ Both CJS and ESM formats

## Registry

Current: **GitHub Packages** (see `.npmrc`)

To switch to npm: Edit `.npmrc` and change to:
```
@munchi:registry=https://registry.npmjs.org/
```
