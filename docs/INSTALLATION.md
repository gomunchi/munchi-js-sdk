# Installation Guide

## Installing from GitHub

This package is installed directly from GitHub. When updating to a new version, pnpm may keep old versions in its store.

### Installation

```bash
pnpm add github:gomunchi/munchi-js-sdk#core-v1.0.4
pnpm add github:gomunchi/munchi-js-sdk#payments-v1.0.4
```

### Updating to a New Version

Due to how pnpm handles GitHub packages, old versions may accumulate in the store. Here's the recommended approach:

#### Option 1: Manual Cleanup (Recommended)

After updating, manually prune the store:

```bash
pnpm update
pnpm store prune
```

#### Option 2: Clean Install

For a fresh installation:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm store prune
```

#### Option 3: Automated Script

Add this script to your consuming project's `package.json`:

```json
{
  "scripts": {
    "postinstall": "pnpm store prune 2>/dev/null || true"
  }
}
```

**Note**: This runs after every `pnpm install`, which may slow down installations slightly but ensures old versions are cleaned up automatically.

#### Option 4: Update Helper Script

Create a file `scripts/update-munchi-sdk.sh` in your project:

```bash
#!/bin/bash

echo "🔄 Updating Munchi SDK..."

# Remove old versions from package.json and node_modules
pnpm remove @munchi/core @munchi/payments 2>/dev/null || true

# Install new versions
VERSION=${1:-latest}
if [ "$VERSION" = "latest" ]; then
  # Get latest tag from GitHub
  LATEST=$(git ls-remote --tags https://github.com/gomunchi/munchi-js-sdk.git | grep -o 'v[0-9]*\.[0-9]*\.[0-9]*$' | sort -V | tail -1 | sed 's/v//')
  echo "📦 Installing version $LATEST"
  pnpm add "github:gomunchi/munchi-js-sdk#core-v$LATEST"
  pnpm add "github:gomunchi/munchi-js-sdk#payments-v$LATEST"
else
  echo "📦 Installing version $VERSION"
  pnpm add "github:gomunchi/munchi-js-sdk#core-v$VERSION"
  pnpm add "github:gomunchi/munchi-js-sdk#payments-v$VERSION"
fi

# Clean up old versions
echo "🧹 Cleaning up old versions..."
pnpm store prune

echo "✅ Update complete!"
```

Make it executable:
```bash
chmod +x scripts/update-munchi-sdk.sh
```

Then use it:
```bash
# Update to latest
./scripts/update-munchi-sdk.sh

# Update to specific version
./scripts/update-munchi-sdk.sh 1.0.4
```

## Why This Happens

pnpm uses content-addressable storage where each unique package URL is stored separately. When you install from GitHub with different tags (e.g., `core-v1.0.3` vs `core-v1.0.4`), pnpm sees these as different packages because the resolved URLs are different:

- `https://codeload.github.com/gomunchi/munchi-js-sdk/tar.gz/[commit-hash-for-1.0.3]`
- `https://codeload.github.com/gomunchi/munchi-js-sdk/tar.gz/[commit-hash-for-1.0.4]`

The `pnpm store prune` command removes packages that are no longer referenced by any `pnpm-lock.yaml` file on your system.
