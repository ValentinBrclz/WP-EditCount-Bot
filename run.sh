#!/usr/bin/env bash
# Get the last version
git pull

# Install any new package
npm install --production

# Start with forever
/shared/bin/node lib/bot.js
