# Deployment Guide for @munchi Packages

This guide explains how to publish the `@munchi/core` and `@munchi/payments` packages to npm with private scope.

## Prerequisites

### 1. npm Account Setup
- Create an npm account at https://www.npmjs.com/signup if you don't have one
- Verify your email address

### 2. Create an Organization (for scoped packages)
- Go to https://www.npmjs.com/org/create
- Create an organization named `munchi`
- Choose the appropriate plan (paid plans required for private packages)

### 3. Generate an Access Token
1. Log in to npm: https://www.npmjs.com/
2. Click your profile picture → "Access Tokens"
3. Click "Generate New Token" → "Classic Token"
4. Select type: **"Automation"** (for CI/CD) or **"Publish"** (for manual publishing)
5. Copy the token (you won't see it again!)

### 4. Configure Authentication

#### Option A: Local Development (using npm login)
```bash
npm login
```
Enter your credentials when prompted.

#### Option B: Using Environment Variable (recommended for CI/CD)
```bash
export NPM_TOKEN=your_token_here
```

Or add to your `.bashrc`/`.zshrc`:
```bash
echo 'export NPM_TOKEN=your_token_here' >> ~/.zshrc
source ~/.zshrc
```

#### Option C: Using .npmrc (local only - DO NOT commit this)
Create/edit `~/.npmrc`:
```
//registry.npmjs.org/:_authToken=YOUR_TOKEN_HERE
```

## Current Configuration

Your packages are currently configured to publish to **GitHub Packages** (see `.npmrc`):
```
@munchi:registry=https://npm.pkg.github.com
```

### To Publish to npm Registry Instead

You have two options:

#### Option 1: Update .npmrc to use npm registry
Edit `/Users/huybui/Projects/work/munchi-js-sdk/.npmrc`:
```
@munchi:registry=https://registry.npmjs.org/
```

#### Option 2: Keep GitHub Packages
If you want to use GitHub Packages instead:
1. Create a GitHub Personal Access Token with `write:packages` scope
2. Authenticate: `npm login --registry=https://npm.pkg.github.com`
3. Username: your GitHub username
4. Password: your GitHub Personal Access Token
5. Email: your GitHub email

## Publishing Packages

### 1. Build All Packages
```bash
pnpm -r build
```

### 2. Publish Individual Packages

#### Publish @munchi/core
```bash
cd core
npm publish
```

#### Publish @munchi/payments
```bash
cd payments
npm publish
```

### 3. Publish All Packages (from root)
```bash
pnpm -r publish
```

## Version Management

### Update Version
```bash
# In the package directory (core or payments)
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

### Automated Workflow
```bash
# 1. Update version
npm version patch

# 2. Build (happens automatically via prepublishOnly)
# 3. Publish
npm publish
```

## Package Configuration

Both packages are configured with:
- ✅ `"publishConfig": { "access": "restricted" }` - Makes packages private
- ✅ `"license": "UNLICENSED"` - Indicates proprietary code
- ✅ `"prepublishOnly": "pnpm build"` - Ensures build before publish
- ✅ `"files": ["dist", "README.md"]` - Only includes necessary files
- ✅ `"exports"` field - Modern module resolution

## Installing Published Packages

### For Private Packages
Users need to authenticate first:
```bash
npm login
```

Then install:
```bash
npm install @munchi/core
npm install @munchi/payments
```

### In package.json
```json
{
  "dependencies": {
    "@munchi/core": "^1.0.0",
    "@munchi/payments": "^1.0.0"
  }
}
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Publish Packages

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      
      - run: pnpm install
      - run: pnpm -r build
      - run: pnpm -r publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Troubleshooting

### Error: "You must sign up for private packages"
- Private scoped packages require a paid npm plan
- Alternatively, make packages public by changing `"access": "restricted"` to `"access": "public"`

### Error: "You do not have permission to publish"
- Ensure you're logged in: `npm whoami`
- Verify you're a member of the `@munchi` organization
- Check your access token has publish permissions

### Error: "Package name too similar to existing package"
- The `@munchi` scope must be available or owned by you
- Create the organization first at https://www.npmjs.com/org/create

### Workspace Dependencies
The `@munchi/payments` package depends on `@munchi/core` with `"workspace:*"`.
When publishing, this will be automatically converted to the actual version number.

## Security Best Practices

1. ✅ Never commit `.npmrc` with tokens to git
2. ✅ Add `.npmrc` to `.gitignore` if it contains tokens
3. ✅ Use environment variables for tokens in CI/CD
4. ✅ Rotate tokens regularly
5. ✅ Use automation tokens for CI/CD, not your personal token
6. ✅ Review package contents before publishing: `npm pack --dry-run`

## Useful Commands

```bash
# Check what will be published
npm pack --dry-run

# View package info
npm view @munchi/core

# Check if you're logged in
npm whoami

# List published versions
npm view @munchi/core versions

# Unpublish a version (within 72 hours)
npm unpublish @munchi/core@1.0.0

# Deprecate a version
npm deprecate @munchi/core@1.0.0 "Use version 1.0.1 instead"
```
