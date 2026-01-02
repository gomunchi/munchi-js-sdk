# GitHub Installation Setup - Complete! ✅

Your `munchi-js-sdk` is now configured for GitHub-based installation. Organization members can install packages directly from the repository without needing npm.

## What Was Configured

### 1. Package Configuration ✅

Both `@munchi/core` and `@munchi/payments` packages now have:

- **`prepare` script** - Automatically builds packages when installed from GitHub
- **`publishConfig`** - Ready for npm if needed in the future
- **`exports` field** - Modern module resolution support
- **`files` array** - Only includes necessary files
- **README files** - Installation and usage instructions

### 2. Installation Methods ✅

Users can install in multiple ways:

```bash
# Method 1: GitHub shorthand (recommended)
npm install github:gomunchi/munchi-js-sdk#core
npm install github:gomunchi/munchi-js-sdk#payments

# Method 2: Git URL with HTTPS
npm install git+https://github.com/gomunchi/munchi-js-sdk.git#core

# Method 3: Git URL with SSH (for private repos)
npm install git+ssh://git@github.com/gomunchi/munchi-js-sdk.git#core

# Method 4: Specific version tag
npm install github:gomunchi/munchi-js-sdk#core-v1.0.0
```

### 3. Version Management ✅

Created `scripts/release.sh` for easy version releases:

```bash
# Create a new release
./scripts/release.sh 1.0.1

# This will:
# 1. Update version.ts
# 2. Build all packages
# 3. Commit changes
# 4. Create git tags (core-v1.0.1, payments-v1.0.1, v1.0.1)
# 5. Push to remote (with confirmation)
```

### 4. Documentation ✅

Created comprehensive guides:

- **README.md** - Main repository documentation
- **GITHUB_INSTALL.md** - Detailed GitHub installation guide
- **DEPLOYMENT.md** - npm deployment guide (for future use)
- **PUBLISH.md** - Quick reference for publishing

## How It Works

### When Someone Installs from GitHub:

1. npm/pnpm clones the repository
2. Checks out the specified branch/tag
3. Runs `npm install` in the package directory
4. Runs the `prepare` script → builds the package
5. Package is ready to use!

### Key Features:

✅ **Free** - No npm subscription needed
✅ **Private** - Only org members with repo access can install
✅ **Automatic builds** - Packages build on install
✅ **Version control** - Use git tags for versions
✅ **No dist/ in git** - Keeps repository clean

## Quick Start for Users

### 1. Ensure GitHub Access

Users need:
- Access to the repository (organization membership)
- Git authentication (SSH key or token)

### 2. Install Packages

Add to `package.json`:
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
```

### 3. Use in Code

```typescript
import { MUNCHI_CORE_VERSION } from '@munchi/core';
import { /* exports */ } from '@munchi/payments';
```

## Creating Releases

### Option 1: Using the Release Script (Recommended)

```bash
./scripts/release.sh 1.0.1
```

### Option 2: Manual Process

```bash
# 1. Update version
echo "export const VERSION = '1.0.1';" > version.ts

# 2. Build
pnpm -r build

# 3. Commit
git add .
git commit -m "chore: bump version to 1.0.1"

# 4. Tag
git tag core-v1.0.1
git tag payments-v1.0.1
git tag v1.0.1

# 5. Push
git push origin main --tags
```

## Authentication Setup for Users

### For Development (SSH - Recommended)

```bash
# Check SSH is working
ssh -T git@github.com

# Install packages
npm install
```

### For CI/CD (Token)

```yaml
# In GitHub Actions
- name: Configure Git
  run: |
    git config --global url."https://x-access-token:${{ secrets.GITHUB_TOKEN }}@github.com/".insteadOf "https://github.com/"

- run: npm install
```

## Advantages Over npm

| Feature | GitHub Install | npm Private |
|---------|---------------|-------------|
| Cost | ✅ Free | ❌ $7/month |
| Access Control | ✅ Repo access | ⚠️ npm teams |
| Setup | ✅ Simple | ⚠️ Org setup |
| Speed | ⚠️ Slower | ✅ Fast |
| Versioning | ✅ Git tags | ✅ Semver |
| CI/CD | ✅ Easy | ✅ Easy |

## Troubleshooting

### "Repository not found"
- User doesn't have access to the repo
- Check GitHub authentication

### "Failed to prepare package"
- Build dependencies might be missing
- Check Node.js version (needs 18+)

### Slow installation
- Normal for GitHub installs (builds on install)
- Consider committing `dist/` for faster installs (trade-off: larger repo)

## Next Steps

1. **Replace `gomunchi`** in all documentation with your actual GitHub organization name
2. **Test installation** in a separate project:
   ```bash
   npm install github:gomunchi/munchi-js-sdk#core
   ```
3. **Create first release**:
   ```bash
   ./scripts/release.sh 1.0.0
   ```
4. **Share with team** - Point them to README.md

## Alternative: Commit dist/ Folders

If you want **faster installations** (no build on install), you can:

1. Remove `dist/` from `.gitignore`
2. Remove `prepare` script from package.json
3. Commit built files to git

**Trade-offs:**
- ✅ Faster installation
- ❌ Larger repository
- ❌ More merge conflicts
- ❌ Cluttered git history

## Files Created/Modified

```
munchi-js-sdk/
├── README.md                    # ✨ Created - Main docs
├── GITHUB_INSTALL.md           # ✨ Created - Installation guide
├── SETUP_COMPLETE.md           # ✨ Created - This file
├── scripts/
│   └── release.sh              # ✨ Created - Release automation
├── core/
│   ├── package.json            # ✏️ Modified - Added prepare script
│   └── README.md               # ✨ Created - Package docs
└── payments/
    ├── package.json            # ✏️ Modified - Added prepare script
    └── README.md               # ✨ Created - Package docs
```

## Summary

✅ Packages configured for GitHub installation
✅ Automatic build on install
✅ Version management with git tags
✅ Release automation script
✅ Comprehensive documentation
✅ Free for organization members
✅ No npm subscription needed

**You're all set!** 🎉

Organization members can now install your packages directly from GitHub. See `README.md` for usage instructions.
