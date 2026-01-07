/**
 * CLI Utilities
 */

import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SpecKitConfig } from '../types';

const CONFIG_FILE = 'spec-kit.yaml';

export function log(message: string): void {
  console.log(message);
}

export function success(message: string): void {
  console.log(chalk.green('✓ ') + message);
}

export function error(message: string): void {
  console.error(chalk.red('✗ ') + message);
}

export function warn(message: string): void {
  console.log(chalk.yellow('⚠ ') + message);
}

export function info(message: string): void {
  console.log(chalk.blue('ℹ ') + message);
}

export function createSpinner(text: string): any {
  return ora({ text, color: 'cyan' });
}

export function findProjectRoot(): string | null {
  let currentDir = process.cwd();
  
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, CONFIG_FILE))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}

export function loadConfig(): SpecKitConfig | null {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    return null;
  }
  
  const configPath = path.join(projectRoot, CONFIG_FILE);
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return yaml.load(content) as SpecKitConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: SpecKitConfig, dir: string = process.cwd()): void {
  const configPath = path.join(dir, CONFIG_FILE);
  const content = yaml.dump(config, { indent: 2 });
  fs.writeFileSync(configPath, content);
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function printBanner(): void {
  console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ███████╗██████╗ ███████╗ ██████╗    ██╗  ██╗██╗████████╗║
║   ██╔════╝██╔══██╗██╔════╝██╔════╝    ██║ ██╔╝██║╚══██╔══╝║
║   ███████╗██████╔╝█████╗  ██║         █████╔╝ ██║   ██║   ║
║   ╚════██║██╔═══╝ ██╔══╝  ██║         ██╔═██╗ ██║   ██║   ║
║   ███████║██║     ███████╗╚██████╗    ██║  ██╗██║   ██║   ║
║   ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝  ╚═╝╚═╝   ╚═╝   ║
║                                                           ║
║   Spec-Driven API Development                             ║
╚═══════════════════════════════════════════════════════════╝
  `));
}
