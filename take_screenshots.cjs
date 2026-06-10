const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function captureScreenshots() {
  const screenshotsDir = path.join(__dirname, 'docs', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Starting dev server...');
  const server = spawn('npm', ['run', 'dev'], { shell: true });

  await new Promise(resolve => setTimeout(resolve, 5000)); // wait for server to start

  console.log('Launching Chrome...');
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--window-size=1920,1080']
  });

  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${chrome.port}`
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const url = 'http://localhost:5173'; // Vite default port

  try {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Screenshot Home
    console.log('Taking screenshot of Home...');
    await page.screenshot({ path: path.join(screenshotsDir, 'home.png') });

    // Navigate to Profiles (Login usually redirects here or we can go directly)
    await page.goto(`${url}/profiles`, { waitUntil: 'networkidle2' });
    console.log('Taking screenshot of Profiles...');
    await page.screenshot({ path: path.join(screenshotsDir, 'profiles.png') });

    // Navigate to Discover
    await page.goto(`${url}/discover`, { waitUntil: 'networkidle2' });
    console.log('Taking screenshot of Discover...');
    await page.screenshot({ path: path.join(screenshotsDir, 'discover.png') });

  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    console.log('Closing browser and server...');
    await browser.disconnect();
    chrome.kill();
    server.kill();
    process.exit(0);
  }
}

captureScreenshots();
