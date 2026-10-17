const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[NexusHub Build] Installing frontend dependencies...');
execSync('npm install', { cwd: path.join(__dirname, 'nexushub-frontend'), stdio: 'inherit' });

console.log('[NexusHub Build] Building frontend with Vite...');
execSync('npm run build', { cwd: path.join(__dirname, 'nexushub-frontend'), stdio: 'inherit' });

const srcDist = path.join(__dirname, 'nexushub-frontend', 'dist');
const destDist = path.join(__dirname, 'dist');

if (fs.existsSync(srcDist)) {
  console.log('[NexusHub Build] Syncing dist to root dist for Render compatibility...');
  if (fs.existsSync(destDist)) {
    fs.rmSync(destDist, { recursive: true, force: true });
  }
  fs.cpSync(srcDist, destDist, { recursive: true });
}

console.log('[NexusHub Build] Build completed successfully!');
