#!/usr/bin/env bash
# Go to DIR
cd ~/WP-EditCount-Bot

# Get the last version
git pull

# Install any new package (prod-only)
npm install --production

# Start
/shared/bin/node lib/bot.js
