# Authentication Setup Summary

This document summarizes the NODE_AUTH_TOKEN setup for GitHub Package Registry authentication.

## What Was Set Up

### 1. `.npmrc` Configuration
**Location:** `/Users/huybui/Projects/work/munchi-js-sdk/.npmrc`

```
@munchi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

This file:
- ✅ Configures the `@munchi` scope to use GitHub Package Registry
- ✅ Uses the `NODE_AUTH_TOKEN` environment variable for authentication
- ✅ Is safe to commit (no hardcoded tokens)
- ✅ Works automatically when `NODE_AUTH_TOKEN` is set

### 2. `.npmrc.template` File
**Location:** `/Users/huybui/Projects/work/munchi-js-sdk/.npmrc.template`

A template file showing users how to configure authentication with different methods:
- Hardcoded token (for local development)
- Environment variable (recommended)

### 3. Authentication Setup Guide
**Location:** `/Users/huybui/Projects/work/munchi-js-sdk/AUTH_SETUP.md`

Comprehensive guide covering:
- How to create GitHub Personal Access Token
- Multiple configuration methods (env var, .npmrc, etc.)
- CI/CD setup for different platforms
- Troubleshooting common issues
- Security best practices

### 4. Setup Script
**Location:** `/Users/huybui/Projects/work/munchi-js-sdk/scripts/setup-auth.sh`

Interactive bash script that:
- Prompts for GitHub token
- Detects user's shell (zsh/bash)
- Adds `NODE_AUTH_TOKEN` to shell profile
- Validates setup

**Usage:**
```bash
./scripts/setup-auth.sh
```

### 5. Updated Documentation
- **README.md** - Added authentication section with quick setup
- **QUICKSTART.md** - Added authentication step for new users
- **.gitignore** - Updated comments about .npmrc handling

## How It Works

### For Organization Members

1. **Create GitHub Personal Access Token**
   - Go to https://github.com/settings/tokens
   - Create token with `read:packages` scope
   - Copy the token

2. **Set Environment Variable**
   ```bash
   export NODE_AUTH_TOKEN=ghp_your_token_here
   ```
   
   Add to `~/.zshrc` or `~/.bashrc` for persistence

3. **Install Packages**
   ```bash
   npm install @munchi/core @munchi/payments
   ```

### Authentication Flow

```
npm install @munchi/core
    ↓
Checks .npmrc for @munchi scope
    ↓
Finds: @munchi:registry=https://npm.pkg.github.com
    ↓
Looks for authentication token
    ↓
Finds: //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
    ↓
Reads NODE_AUTH_TOKEN from environment
    ↓
Authenticates with GitHub Package Registry
    ↓
Downloads and installs package
```

## Installation Methods Comparison

| Method | Auth Required | Speed | Best For |
|--------|---------------|-------|----------|
| GitHub Package Registry (`npm install @munchi/core`) | Yes (NODE_AUTH_TOKEN) | Fast | Production, CI/CD |
| Direct GitHub (`npm install github:gomunchi/munchi-js-sdk#core`) | No (if repo access) | Slower | Development |
| Git URL with SSH | No (if SSH key) | Slower | Development |

## CI/CD Integration

### GitHub Actions
```yaml
- name: Install dependencies
  run: npm install
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Other Platforms
Add `NODE_AUTH_TOKEN` as a secret/environment variable with your GitHub Personal Access Token.

## Security Considerations

✅ **Safe to commit:**
- `.npmrc` (uses environment variable)
- `.npmrc.template` (template only)
- All documentation files

❌ **Never commit:**
- `.npmrc` with hardcoded tokens
- `.env` files with tokens
- Any file containing `ghp_*` tokens

## Troubleshooting

### Check if NODE_AUTH_TOKEN is set
```bash
echo $NODE_AUTH_TOKEN
```

### Test authentication
```bash
npm view @munchi/core
```

### Verify .npmrc configuration
```bash
cat .npmrc
```

## Next Steps for Organization Members

1. **Read the Quick Start:**
   - See [QUICKSTART.md](./QUICKSTART.md)

2. **Set Up Authentication:**
   - Run `./scripts/setup-auth.sh`
   - Or follow [AUTH_SETUP.md](./AUTH_SETUP.md)

3. **Install Packages:**
   ```bash
   npm install @munchi/core @munchi/payments
   ```

4. **Start Using:**
   ```typescript
   import { MUNCHI_CORE_VERSION } from '@munchi/core';
   ```

## Maintenance

### Rotating Tokens
1. Generate new token on GitHub
2. Update `NODE_AUTH_TOKEN` environment variable
3. Test installation
4. Revoke old token

### Updating Documentation
When making changes to authentication:
1. Update [AUTH_SETUP.md](./AUTH_SETUP.md)
2. Update this summary
3. Test all installation methods
4. Notify team members

## Resources

- **GitHub Packages Documentation:** https://docs.github.com/en/packages
- **Creating Personal Access Tokens:** https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
- **npm Configuration:** https://docs.npmjs.com/cli/v9/configuring-npm/npmrc

---

**Setup Date:** 2026-01-02  
**Last Updated:** 2026-01-02
