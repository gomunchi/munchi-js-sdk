#!/bin/bash

# Munchi SDK Authentication Setup Script
# This script helps you set up authentication for installing @munchi packages

set -e

echo "🔐 Munchi SDK Authentication Setup"
echo "===================================="
echo ""

# Check if NODE_AUTH_TOKEN is already set
if [ -n "$NODE_AUTH_TOKEN" ]; then
    echo "✅ NODE_AUTH_TOKEN is already set in your environment"
    echo ""
    echo "Testing authentication..."
    if npm view @munchi_oy/core > /dev/null 2>&1; then
        echo "✅ Authentication is working!"
        exit 0
    else
        echo "⚠️  NODE_AUTH_TOKEN is set but authentication failed"
        echo "You may need to update your token"
    fi
fi

echo "This script will help you set up GitHub authentication for @munchi packages."
echo ""
echo "You'll need a GitHub Personal Access Token with 'read:packages' scope."
echo "If you don't have one, create it here: https://github.com/settings/tokens"
echo ""

# Prompt for token
read -p "Enter your GitHub Personal Access Token: " -s GITHUB_TOKEN
echo ""

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ No token provided. Exiting."
    exit 1
fi

# Detect shell
SHELL_NAME=$(basename "$SHELL")
case "$SHELL_NAME" in
    zsh)
        PROFILE_FILE="$HOME/.zshrc"
        ;;
    bash)
        if [ -f "$HOME/.bashrc" ]; then
            PROFILE_FILE="$HOME/.bashrc"
        else
            PROFILE_FILE="$HOME/.bash_profile"
        fi
        ;;
    *)
        echo "⚠️  Unknown shell: $SHELL_NAME"
        echo "Please manually add the following to your shell profile:"
        echo ""
        echo "export NODE_AUTH_TOKEN=$GITHUB_TOKEN"
        exit 1
        ;;
esac

echo ""
echo "Detected shell: $SHELL_NAME"
echo "Profile file: $PROFILE_FILE"
echo ""

# Ask for confirmation
read -p "Add NODE_AUTH_TOKEN to $PROFILE_FILE? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if already exists
    if grep -q "NODE_AUTH_TOKEN" "$PROFILE_FILE" 2>/dev/null; then
        echo "⚠️  NODE_AUTH_TOKEN already exists in $PROFILE_FILE"
        read -p "Update it? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Remove old entry
            sed -i.bak '/NODE_AUTH_TOKEN/d' "$PROFILE_FILE"
            echo "export NODE_AUTH_TOKEN=$GITHUB_TOKEN" >> "$PROFILE_FILE"
            echo "✅ Updated NODE_AUTH_TOKEN in $PROFILE_FILE"
        else
            echo "Skipped updating $PROFILE_FILE"
        fi
    else
        # Add new entry
        echo "" >> "$PROFILE_FILE"
        echo "# GitHub Package Registry authentication for @munchi packages" >> "$PROFILE_FILE"
        echo "export NODE_AUTH_TOKEN=$GITHUB_TOKEN" >> "$PROFILE_FILE"
        echo "✅ Added NODE_AUTH_TOKEN to $PROFILE_FILE"
    fi
    
    # Set for current session
    export NODE_AUTH_TOKEN=$GITHUB_TOKEN
    
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "To use in your current terminal session, run:"
    echo "  source $PROFILE_FILE"
    echo ""
    echo "Or open a new terminal window."
    echo ""
    echo "You can now install packages with:"
    echo "  npm install @munchi_oy/core @munchi_oy/payments"
else
    echo ""
    echo "Setup cancelled. To set up manually, add this to your $PROFILE_FILE:"
    echo ""
    echo "export NODE_AUTH_TOKEN=$GITHUB_TOKEN"
fi
