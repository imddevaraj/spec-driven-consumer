#!/usr/bin/env node
/**
 * Spec-Kit CLI Entry Point
 * 
 * Commands:
 * - spec init <project-name>     Initialize a new Spec-Kit project
 * - spec generate                Generate OpenAPI, SDK, or consumer code
 * - spec plan                    Create implementation tasks from intent
 * - spec implement               Execute implementation tasks
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';
import { generateCommand } from './commands/generate';
import { planCommand } from './commands/plan';
import { implementCommand } from './commands/implement';
import { syncCommand } from './commands/sync';

const program = new Command();

program
  .name('spec')
  .description(chalk.cyan('Origo-Spec-Kit: Origo Spec-driven API client development'))
  .version('1.0.0');

// Register commands
program.addCommand(initCommand);
program.addCommand(generateCommand);
program.addCommand(planCommand);
program.addCommand(implementCommand);
program.addCommand(syncCommand);

// Custom help
program.on('--help', () => {
  console.log('');
  console.log(chalk.yellow('Workflow:'));
  console.log('  1. spec init my-api           # Initialize project');
  console.log('  2. spec generate openapi      # Generate OpenAPI spec');
  console.log('  3. spec generate sdk          # Generate SDK from spec');
  console.log('  4. spec plan "intent"         # Plan implementation');
  console.log('  5. spec implement             # Generate consumer code');
  console.log('');
  console.log(chalk.gray('OpenAPI is the single source of truth.'));
  console.log(chalk.gray('If something is missing, update the spec first.'));
});

program.parse(process.argv);
