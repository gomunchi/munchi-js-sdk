#!/bin/bash

# Release script for munchi-js-sdk
# Usage: ./scripts/release.sh [version] [options]
# Example: ./scripts/release.sh 1.0.1
# Example: ./scripts/release.sh 1.0.1 --publish
# Example: ./scripts/release.sh 1.0.1 --publish=custom
#
# Options:
#   --publish, -p          Create a GitHub release with auto-generated notes
#   --publish=custom       Create a GitHub release with custom description (opens editor)
#   --publish=file         Create a GitHub release using RELEASE_NOTES.md

set -e

VERSION=""
PUBLISH=""
PUBLISH_MODE="auto"

while [[ $# -gt 0 ]]; do
  case $1 in
    --publish=*)
      PUBLISH="true"
      PUBLISH_MODE="${1#*=}"
      shift
      ;;
    --publish|-p)
      PUBLISH="true"
      PUBLISH_MODE="auto"
      shift
      ;;
    *)
      if [ -z "$VERSION" ]; then
        VERSION="$1"
      fi
      shift
      ;;
  esac
done

if [ -z "$VERSION" ]; then
  echo "❌ Error: Version number required"
  echo "Usage: ./scripts/release.sh [version] [options]"
  echo "Example: ./scripts/release.sh 1.0.1"
  echo "Example: ./scripts/release.sh 1.0.1 --publish"
  echo ""
  echo "Options:"
  echo "  --publish, -p          Create a GitHub release with auto-generated notes"
  echo "  --publish=custom       Create a GitHub release with custom description (opens editor)"
  echo "  --publish=file         Create a GitHub release using RELEASE_NOTES.md"
  exit 1
fi

echo "🚀 Releasing version $VERSION"
echo ""

# Update version in root version.ts
echo "📝 Updating root version.ts..."
cat > version.ts << EOF
export const VERSION = '$VERSION';
EOF

echo "✅ Updated root version.ts to $VERSION"
echo ""

# Update version in root package.json
echo "📝 Updating root package.json..."
node -e "
const fs = require('fs');
const path = require('path');
const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
pkg.version = '$VERSION';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log('✅ Updated root package.json to $VERSION');
"

# Update version in core/package.json
echo "📝 Updating core/package.json..."
node -e "
const fs = require('fs');
const path = require('path');
const pkgPath = path.join(__dirname, 'core', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
pkg.version = '$VERSION';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log('✅ Updated core/package.json to $VERSION');
"

# Update version in payments/package.json
echo "📝 Updating payments/package.json..."
node -e "
const fs = require('fs');
const path = require('path');
const pkgPath = path.join(__dirname, 'payments', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
pkg.version = '$VERSION';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log('✅ Updated payments/package.json to $VERSION');
"

# Update version in react/package.json
echo "📝 Updating react/package.json..."
node -e "
const fs = require('fs');
const path = require('path');
const pkgPath = path.join(__dirname, 'react', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
pkg.version = '$VERSION';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log('✅ Updated react/package.json to $VERSION');
"

echo ""

# Build all packages (this will trigger version:sync via prebuild)
echo "🔨 Building packages..."
pnpm -r build

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ Build successful"
echo ""

# Commit changes
echo "📦 Committing changes..."
git add package.json version.ts core/package.json core/src/version.ts payments/package.json payments/src/version.ts react/package.json react/src/version.ts
git commit -m "chore: bump version to $VERSION"

echo "✅ Changes committed"
echo ""

# Create tags
echo "🏷️  Creating git tags..."
git tag "core-v$VERSION" -m "Release @munchi/core v$VERSION"
git tag "payments-v$VERSION" -m "Release @munchi/payments v$VERSION"
git tag "react-v$VERSION" -m "Release @munchi/react v$VERSION"
git tag "v$VERSION" -m "Release v$VERSION"

echo "✅ Tags created:"
echo "   - core-v$VERSION"
echo "   - payments-v$VERSION"
echo "   - react-v$VERSION"
echo "   - v$VERSION"
echo ""

# Push
echo "📤 Pushing to remote..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push origin "$CURRENT_BRANCH"
git push origin --tags
echo "✅ Pushed to remote branch $CURRENT_BRANCH"
echo ""

if [ "$PUBLISH" == "true" ]; then
    echo "📢 Creating GitHub release..."
    
    if ! command -v gh &> /dev/null; then
      echo "❌ Error: GitHub CLI (gh) is not installed."
      echo "   Install it with: brew install gh"
      echo "   Then authenticate: gh auth login"
      exit 1
    fi

    case $PUBLISH_MODE in
      auto)
        echo "   Using auto-generated release notes..."
        gh release create "v$VERSION" \
          --title "Release v$VERSION" \
          --generate-notes \
          --latest
        ;;
      custom)
        echo "   Opening editor for custom release notes..."
        gh release create "v$VERSION" \
          --title "Release v$VERSION" \
          --latest
        ;;
      file)
        if [ -f "RELEASE_NOTES.md" ]; then
          echo "   Using RELEASE_NOTES.md..."
          gh release create "v$VERSION" \
            --title "Release v$VERSION" \
            --notes-file RELEASE_NOTES.md \
            --latest
        else
          echo "❌ Error: RELEASE_NOTES.md not found"
          echo "   Create the file or use --publish for auto-generated notes"
          exit 1
        fi
        ;;
      *)
        echo "❌ Error: Unknown publish mode '$PUBLISH_MODE'"
        echo "   Valid modes: auto (default), custom, file"
        exit 1
        ;;
    esac

    echo "✅ GitHub release created!"
    echo "   View at: https://github.com/gomunchi/munchi-js-sdk/releases/tag/v$VERSION"
  fi

  echo ""
  echo "🎉 Release $VERSION complete!"
  echo ""
  echo "📦 Install with npm:"
  echo "   npm install github:gomunchi/munchi-js-sdk#core-v$VERSION github:gomunchi/munchi-js-sdk#payments-v$VERSION github:gomunchi/munchi-js-sdk#react-v$VERSION"
  echo ""
  echo "📦 Install with pnpm:"
  echo "   pnpm add github:gomunchi/munchi-js-sdk#core-v$VERSION github:gomunchi/munchi-js-sdk#payments-v$VERSION github:gomunchi/munchi-js-sdk#react-v$VERSION"
else
  echo "⏸️  Skipped push. Run manually with:"
  echo "   git push origin master"
  echo "   git push origin --tags"
  if [ "$PUBLISH" == "true" ]; then
    echo ""
    echo "   Then create release with:"
    echo "   gh release create v$VERSION --title \"Release v$VERSION\" --generate-notes --latest"
  fi
fi
