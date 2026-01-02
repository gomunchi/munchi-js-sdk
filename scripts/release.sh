#!/bin/bash

# Release script for munchi-js-sdk
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh 1.0.1

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "❌ Error: Version number required"
  echo "Usage: ./scripts/release.sh [version]"
  echo "Example: ./scripts/release.sh 1.0.1"
  exit 1
fi

echo "🚀 Releasing version $VERSION"
echo ""

# Update version in version.ts
echo "📝 Updating version.ts..."
cat > version.ts << EOF
export const VERSION = '$VERSION';
EOF

echo "✅ Updated version.ts to $VERSION"
echo ""

# Build all packages
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
git add version.ts core/src/version.ts payments/src/version.ts
git commit -m "chore: bump version to $VERSION"

echo "✅ Changes committed"
echo ""

# Create tags
echo "🏷️  Creating git tags..."
git tag "core-v$VERSION" -m "Release @munchi/core v$VERSION"
git tag "payments-v$VERSION" -m "Release @munchi/payments v$VERSION"
git tag "v$VERSION" -m "Release v$VERSION"

echo "✅ Tags created:"
echo "   - core-v$VERSION"
echo "   - payments-v$VERSION"
echo "   - v$VERSION"
echo ""

# Push
echo "📤 Pushing to remote..."
read -p "Push changes and tags to remote? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push origin main
  git push origin --tags
  echo "✅ Pushed to remote"
  echo ""
  echo "🎉 Release $VERSION complete!"
  echo ""
  echo "📦 Install with:"
  echo "   npm install github:YOUR_ORG/munchi-js-sdk#core-v$VERSION"
  echo "   npm install github:YOUR_ORG/munchi-js-sdk#payments-v$VERSION"
else
  echo "⏸️  Skipped push. Run manually with:"
  echo "   git push origin main"
  echo "   git push origin --tags"
fi
