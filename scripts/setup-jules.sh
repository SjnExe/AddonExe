#!/bin/bash
set -e

echo "Starting Jules environment setup..."

# 1. Handle Branch Switching
CURRENT_BRANCH=$(git branch --show-current)
TARGET_BRANCH="Dev"

if [ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]; then
    echo "Current branch is '$CURRENT_BRANCH'. Switching to '$TARGET_BRANCH'..."

    # Fetch the specific branch to ensure we have the latest ref
    git fetch origin $TARGET_BRANCH

    # Checkout and track
    git checkout $TARGET_BRANCH
    git pull origin $TARGET_BRANCH
else
    echo "Already on '$TARGET_BRANCH' branch."
    git pull origin $TARGET_BRANCH
fi

# 2. Install & Update Dependencies
echo "Installing and updating dependencies..."
npm install
npm update

# 3. Run Development Tasks
echo "Formatting code..."
npm run format

echo "Linting and fixing code..."
npm run lint:fix

echo "Building project..."
npm run build

echo "Jules environment setup complete!"
