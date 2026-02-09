#!/bin/bash

# Publish all packages to npm
# Order: core -> payments -> react

set -e

echo "🚀 Starting publish process..."

# 1. Build everything
echo "🔨 Building all packages..."
pnpm build

# 2. Publish Core
echo "📦 Publishing @munchi_oy/core..."
cd core
npm publish --access public
cd ..

# 3. Publish Payments
echo "📦 Publishing @munchi_oy/payments..."
cd payments
npm publish --access public
cd ..

# 4. Publish React
echo "📦 Publishing @munchi_oy/react..."
cd react
npm publish --access public
cd ..

echo "✅ All packages published successfully!"
