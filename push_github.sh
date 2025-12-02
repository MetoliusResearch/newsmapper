#!/bin/bash
# Push all changes to GitHub

echo "=== Pushing updates to GitHub ==="
echo ""

# Stage all changes
echo "Staging all changes..."
git add -A

# Show status
echo ""
echo "Git status:"
git status

# Ask for commit message
echo ""
read -p "Enter commit message: " commit_message

# If no message provided, use default
if [ -z "$commit_message" ]; then
    commit_message="Update project files"
fi

# Commit changes
echo ""
echo "Committing changes..."
git commit -m "$commit_message"

# Push to GitHub
echo ""
echo "Pushing to GitHub..."
git push origin main

# Push to gh-pages
echo ""
echo "Deploying to GitHub Pages..."
git push origin main:gh-pages --force

echo ""
echo "=== Done! ==="
echo "GitHub Pages will deploy in 1-3 minutes"
echo "Check deployment status at: https://github.com/MetoliusResearch/newsmapper/actions"
