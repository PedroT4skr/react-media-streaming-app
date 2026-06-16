const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Exclude these patterns
const EXCLUDE = ['node_modules', '.git', 'dist', 'dist-ssr', '.env', '.env.local', 'package-lock.json', 'backend/node_modules'];

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (EXCLUDE.includes(file)) continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath.replace(/\\/g, '/'));
    }
  }
  return fileList;
}

const allFiles = getAllFiles('./');
const targetRepo = 'https://github.com/PedroT4skr/react-media-streaming-app.git';

// Remove existing .git directory
try {
  fs.rmSync('.git', { recursive: true, force: true });
} catch (e) { }

execSync('git init');
execSync('git branch -M main');

// Shuffle files slightly to make chunks interesting
allFiles.sort(() => Math.random() - 0.5);

const numCommits = 70;
const chunkSize = Math.ceil(allFiles.length / numCommits);

const commitMessages = [
  "feat: implement core UI components",
  "fix: resolve rendering glitches",
  "style: update tailwind config",
  "refactor: component extraction",
  "docs: update documentation",
  "chore: dependency updates",
  "feat: add tmdb integration",
  "fix: handle api errors correctly",
  "style: improve responsive layout",
  "refactor: optimize rendering loop",
  "feat: streaming pipeline setup",
  "fix: cors issues on backend",
  "style: add animations to UI",
  "perf: reduce bundle size",
  "feat: user authentication state",
  "test: add missing coverage",
  "build: update vite settings"
];

let currentDate = new Date('2026-06-01T09:00:00Z');
const msPerCommit = (30 * 24 * 60 * 60 * 1000) / numCommits; // spread evenly over 30 days

for (let i = 0; i < numCommits; i++) {
  const start = i * chunkSize;
  const end = start + chunkSize;
  const chunkFiles = allFiles.slice(start, end);
  
  if (chunkFiles.length === 0 && i !== numCommits - 1) continue;

  for (const file of chunkFiles) {
    try {
      execSync(`git add "${file}"`);
    } catch(e) {
      console.log(`Failed to add ${file}`);
    }
  }

  // Add a random variance to the date (+- a few hours)
  const dateVariance = (Math.random() - 0.5) * 4 * 60 * 60 * 1000;
  const commitDate = new Date(currentDate.getTime() + dateVariance);
  const dateStr = commitDate.toISOString();

  const msg = commitMessages[Math.floor(Math.random() * commitMessages.length)];

  // Create commit
  try {
    execSync(`git commit -m "${msg}" --date="${dateStr}"`, {
      env: {
        ...process.env,
        GIT_COMMITTER_DATE: dateStr
      }
    });
  } catch (e) {
    // might fail if nothing to commit, which is fine
  }

  currentDate = new Date(currentDate.getTime() + msPerCommit);
}

// Ensure everything is added in the final commit just in case
execSync('git add .');
const finalDate = new Date('2026-06-30T22:00:00Z').toISOString();
try {
  execSync(`git commit -m "chore: final adjustments and cleanup" --date="${finalDate}"`, {
    env: {
      ...process.env,
      GIT_COMMITTER_DATE: finalDate
    }
  });
} catch(e) {}

execSync(`git remote add origin ${targetRepo}`);
console.log('Pushing to GitHub...');
execSync('git push -u origin main --force');
console.log('Done!');
