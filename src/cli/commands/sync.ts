/**
 * spec sync command
 * 
 * Syncs OpenAPI spec from a provider URL
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { success, error, info, createSpinner, loadConfig, findProjectRoot } from '../utils';

export const syncCommand = new Command('sync')
  .description('Sync OpenAPI spec from provider')
  .option('-u, --url <url>', 'URL to fetch OpenAPI spec from')
  .option('-f, --file <path>', 'Local file path to copy spec from')
  .action(async (options) => {
    const projectRoot = findProjectRoot();
    const config = loadConfig();
    
    if (!projectRoot || !config) {
      error('Not in a Spec-Kit project. Run "spec init <name>" first.');
      process.exit(1);
    }
    
    const specPath = path.join(projectRoot, config.openapi);
    
    // Fetch or copy spec
    if (options.url) {
      const spinner = createSpinner(`Fetching spec from ${options.url}...`);
      spinner.start();
      
      try {
        const content = await fetchSpec(options.url);
        fs.writeFileSync(specPath, content);
        spinner.succeed('OpenAPI spec fetched');
        success(`Saved to: ${config.openapi}`);
      } catch (err) {
        spinner.fail('Failed to fetch spec');
        error(String(err));
        process.exit(1);
      }
    } else if (options.file) {
      if (!fs.existsSync(options.file)) {
        error(`File not found: ${options.file}`);
        process.exit(1);
      }
      
      const content = fs.readFileSync(options.file, 'utf-8');
      fs.writeFileSync(specPath, content);
      success(`Spec copied from: ${options.file}`);
    } else {
      error('Please provide --url <url> or --file <path>');
      process.exit(1);
    }
    
    console.log('');
    info('Next steps:');
    console.log('  spec plan "<intent>"     # Create implementation tasks');
    console.log('  spec implement           # Generate client code');
  });

/**
 * Fetch spec from URL
 */
async function fetchSpec(url: string): Promise<string> {
  // Validate URL format
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required. Use: spec sync --url <url>');
  }
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(`Invalid URL: ${url}. URL must start with http:// or https://`);
  }
  
  return new Promise((resolve, reject) => {
    try {
      const client = url.startsWith('https') ? https : http;
      
      client.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: Failed to fetch spec from ${url}`));
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', (err) => {
        reject(new Error(`Failed to connect to ${url}: ${err.message}`));
      });
    } catch (err) {
      reject(new Error(`Invalid URL format: ${url}`));
    }
  });
}
