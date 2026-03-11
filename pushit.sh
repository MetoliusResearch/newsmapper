#!/bin/bash
# Push source to main + build and deploy to GitHub Pages (gh-pages branch)

set -e

echo "=== NewsMapper 2.0 — Push & Deploy ==="
echo ""

# Stage all changes
echo "Staging all changes..."
git add -A

echo ""
echo "Git status:"
git status

# Ask for commit message
echo ""
read -p "Enter commit message: " commit_message
if [ -z "$commit_message" ]; then
  commit_message="Update project files"
fi

# Commit and push source to main
echo ""
echo "Committing and pushing source to main..."
git commit -m "$commit_message" || echo "(nothing new to commit)"
git push upstream main

# Build and deploy to gh-pages
echo ""
echo "Building and deploying to GitHub Pages..."
npm run deploy

echo ""
echo "=== Done! ==="
echo "GitHub Pages will update in ~1–2 minutes."
echo "Check: https://metoliusresearch.org/newsmapper"
