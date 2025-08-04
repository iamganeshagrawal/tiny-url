#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Build script for Cloudflare Worker URL Shortener
 * This script reads urls.json and embeds it into the worker script
 */

const URLS_FILE = 'urls.json';
const WORKER_SOURCE = 'src/worker.js';
const WORKER_OUTPUT = 'dist/worker.js';
const PLACEHOLDER = '__URL_MAPPINGS__';

function main() {
  try {
    console.log('🔨 Building URL Shortener Worker...');
    
    // Ensure dist directory exists
    const distDir = path.dirname(WORKER_OUTPUT);
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
      console.log(`📁 Created directory: ${distDir}`);
    }

    // Read URLs configuration
    console.log(`📖 Reading URLs from ${URLS_FILE}...`);
    if (!fs.existsSync(URLS_FILE)) {
      console.error(`❌ Error: ${URLS_FILE} not found!`);
      console.log('💡 Create a urls.json file with your URL mappings.');
      process.exit(1);
    }

    const urlsContent = fs.readFileSync(URLS_FILE, 'utf8');
    let urls;
    
    try {
      urls = JSON.parse(urlsContent);
    } catch (error) {
      console.error(`❌ Error parsing ${URLS_FILE}:`, error.message);
      process.exit(1);
    }

    // Validate URLs object
    if (typeof urls !== 'object' || urls === null || Array.isArray(urls)) {
      console.error(`❌ Error: ${URLS_FILE} must contain a JSON object with key-value pairs`);
      process.exit(1);
    }

    // Validate each URL
    const urlCount = Object.keys(urls).length;
    console.log(`✅ Found ${urlCount} URL mappings`);
    
    let hasErrors = false;
    for (const [key, value] of Object.entries(urls)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        console.error(`❌ Error: Invalid mapping - keys and values must be strings`);
        hasErrors = true;
      }
      
      if (key.includes('/') || key.includes(' ') || key.includes('?')) {
        console.error(`❌ Error: Invalid key "${key}" - keys should be simple alphanumeric strings`);
        hasErrors = true;
      }

      try {
        new URL(value);
      } catch {
        console.error(`❌ Error: Invalid URL "${value}" for key "${key}"`);
        hasErrors = true;
      }
    }

    if (hasErrors) {
      console.error('❌ Please fix the errors above and try again.');
      process.exit(1);
    }

    // Read worker source
    console.log(`📖 Reading worker source from ${WORKER_SOURCE}...`);
    if (!fs.existsSync(WORKER_SOURCE)) {
      console.error(`❌ Error: ${WORKER_SOURCE} not found!`);
      process.exit(1);
    }

    const workerSource = fs.readFileSync(WORKER_SOURCE, 'utf8');

    // Check if placeholder exists
    if (!workerSource.includes(PLACEHOLDER)) {
      console.error(`❌ Error: Placeholder ${PLACEHOLDER} not found in ${WORKER_SOURCE}`);
      process.exit(1);
    }

    // Replace placeholder with actual URLs
    const urlsJson = JSON.stringify(urls, null, 2);
    const builtWorker = workerSource.replace(PLACEHOLDER, urlsJson);

    // Write output
    console.log(`💾 Writing built worker to ${WORKER_OUTPUT}...`);
    fs.writeFileSync(WORKER_OUTPUT, builtWorker, 'utf8');

    // Create build info
    const buildInfo = {
      buildTime: new Date().toISOString(),
      urlCount: urlCount,
      sourceFiles: {
        urls: URLS_FILE,
        worker: WORKER_SOURCE
      },
      outputFile: WORKER_OUTPUT
    };

    fs.writeFileSync('dist/build-info.json', JSON.stringify(buildInfo, null, 2));

    console.log('✅ Build completed successfully!');
    console.log(`📊 Build info:`);
    console.log(`   • URLs loaded: ${urlCount}`);
    console.log(`   • Output: ${WORKER_OUTPUT}`);
    console.log(`   • Build time: ${buildInfo.buildTime}`);
    
    // Preview some URLs
    const urlPairs = Object.entries(urls).slice(0, 3);
    if (urlPairs.length > 0) {
      console.log('🔗 Sample URLs:');
      urlPairs.forEach(([key, value]) => {
        console.log(`   • /${key} → ${value}`);
      });
      if (urlCount > 3) {
        console.log(`   • ... and ${urlCount - 3} more`);
      }
    }

  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };