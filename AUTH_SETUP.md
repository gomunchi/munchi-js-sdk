# GitHub Authentication Setup Guide

This guide explains how to set up authentication for installing `@munchi` packages from GitHub Package Registry.

## Quick Setup

### Step 1: Create a GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Or visit: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Munchi SDK Access")
4. Select the following scopes:
   - ✅ `read:packages` - Download packages from GitHub Package Registry
   - ✅ `repo` (if repository is private) - Access private repositories
5. Click "Generate token"
6. **IMPORTANT**: Copy the token immediately - you won't be able to see it again!

### Step 2: Configure Your Environment

Choose one of the following methods:

#### Method A: Environment Variable (Recommended)

Add to your shell profile (`~/.zshrc`, `~/.bashrc`, or `~/.bash_profile`):

```bash
export NODE_AUTH_TOKEN=ghp_your_token_here
```

Then reload your shell:
```bash
source ~/.zshrc  # or ~/.bashrc
```

#### Method B: .npmrc in Your Home Directory

Create or edit `~/.npmrc`:

```
//npm.pkg.github.com/:_authToken=ghp_your_token_here
```

#### Method C: Project-Specific .npmrc

Create `.npmrc` in your project root (add to `.gitignore`!):

```
@munchi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_your_token_here
```

**⚠️ IMPORTANT**: Add `.npmrc` to your `.gitignore` to avoid committing your token!

## Installation After Setup

Once authentication is configured, install packages normally:

```bash
# Using npm
npm install @munchi_oy/core @munchi_oy/payments

# Using pnpm
pnpm add @munchi_oy/core @munchi_oy/payments

# Using yarn
yarn add @munchi_oy/core @munchi_oy/payments
```

## CI/CD Setup

### GitHub Actions

GitHub Actions automatically provides a `GITHUB_TOKEN` that can be used:

```yaml
name: Build

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@munchi'
      
      - name: Install dependencies
        run: npm install
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Other CI/CD Platforms

Add `NODE_AUTH_TOKEN` as a secret/environment variable in your CI/CD platform:

1. Create a GitHub Personal Access Token (as described above)
2. Add it as a secret in your CI/CD platform
3. Set it as `NODE_AUTH_TOKEN` environment variable

**Examples:**

- **GitLab CI**: Add to Settings → CI/CD → Variables
- **CircleCI**: Add to Project Settings → Environment Variables
- **Jenkins**: Add to Credentials
- **Vercel**: Add to Project Settings → Environment Variables

## Verification

Test that authentication is working:

```bash
# Check if you can access the registry
npm view @munchi_oy/core

# Or try installing
npm install @munchi_oy/core
```

## Troubleshooting

### Error: "Unable to authenticate"

**Solution**: Check that your token is correctly set:
```bash
echo $NODE_AUTH_TOKEN  # Should show your token
```

### Error: "404 Not Found"

**Possible causes**:
1. Token doesn't have `read:packages` scope
2. You don't have access to the `gomunchi` organization
3. Package name is incorrect

**Solution**: 
- Verify token scopes
- Contact organization admin for access
- Check package name in `package.json`

### Error: "401 Unauthorized"

**Possible causes**:
1. Token is expired or invalid
2. Token not properly configured

**Solution**:
- Generate a new token
- Verify `.npmrc` configuration
- Check environment variable is set

### Packages installing from wrong registry

**Solution**: Ensure `.npmrc` has the scope configuration:
```
@munchi:registry=https://npm.pkg.github.com
```

## Security Best Practices

1. ✅ **Never commit tokens** to git
2. ✅ **Use environment variables** instead of hardcoding
3. ✅ **Add `.npmrc` to `.gitignore`** if it contains tokens
4. ✅ **Rotate tokens regularly**
5. ✅ **Use minimal scopes** - only `read:packages` if possible
6. ✅ **Use different tokens** for different environments
7. ✅ **Revoke unused tokens** from GitHub settings

## Token Management

### Rotating Tokens

1. Generate a new token (follow Step 1)
2. Update environment variable or `.npmrc`
3. Test installation
4. Revoke old token from GitHub

### Revoking Access

1. Go to https://github.com/settings/tokens
2. Find the token
3. Click "Delete" or "Revoke"

## Alternative: Using GitHub CLI

If you have GitHub CLI installed:

```bash
# Login to GitHub
gh auth login

# Configure npm to use GitHub CLI token
gh auth setup-git
```

## Example .gitignore

Make sure your `.gitignore` includes:

```gitignore
# NPM
node_modules/
.npmrc

# Environment variables
.env
.env.local
```

## Need Help?

- **GitHub Packages Documentation**: https://docs.github.com/en/packages
- **Creating Personal Access Tokens**: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
- **Contact**: Reach out to your organization administrator

## Summary

**For Developers:**
1. Create GitHub Personal Access Token with `read:packages` scope
2. Set `NODE_AUTH_TOKEN` environment variable
3. Run `npm install`

**For CI/CD:**
1. Add token as secret
2. Set `NODE_AUTH_TOKEN` in workflow
3. Run install commands normally
