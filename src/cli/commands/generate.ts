/**
 * spec generate command
 * 
 * Generates OpenAPI specs, SDKs, or consumer code
 */

import { Command } from 'commander';
import * as path from 'path';
import { success, error, info, createSpinner, loadConfig, findProjectRoot } from '../utils';
import { SpecGenerator } from '../../core/spec-generator';
import { SDKGenerator } from '../../core/sdk-generator';
import { ConsumerGenerator } from '../../core/consumer-generator';
import { SupportedLanguage } from '../../types';

export const generateCommand = new Command('generate')
  .description('Generate OpenAPI spec, SDK, or consumer code');

// Subcommand: generate openapi
generateCommand
  .command('openapi')
  .description('Generate or update OpenAPI specification')
  .option('-f, --from <description>', 'Natural language API description')
  .option('-t, --template <name>', 'Use a predefined template (crud, rest, graphql)')
  .option('-o, --output <path>', 'Output file path')
  .action(async (options) => {
    const projectRoot = findProjectRoot();
    const config = loadConfig();
    
    if (!projectRoot || !config) {
      error('Not in a Spec-Kit project. Run "spec init <name>" first.');
      process.exit(1);
    }
    
    const spinner = createSpinner('Generating OpenAPI specification...');
    spinner.start();
    
    try {
      const generator = new SpecGenerator();
      const outputPath = options.output || config.openapi;
      const fullPath = path.join(projectRoot, outputPath);
      
      if (options.from) {
        await generator.generateFromDescription(options.from, fullPath, config.name);
      } else if (options.template) {
        await generator.generateFromTemplate(options.template, fullPath, config.name);
      } else {
        spinner.stop();
        error('Please provide --from <description> or --template <name>');
        process.exit(1);
      }
      
      spinner.succeed('OpenAPI specification generated');
      success(`Saved to: ${outputPath}`);
      info('Run "spec generate sdk" to generate the client SDK');
    } catch (err) {
      spinner.fail('Failed to generate OpenAPI specification');
      error(String(err));
      process.exit(1);
    }
  });

// Subcommand: generate sdk
generateCommand
  .command('sdk')
  .description('Generate client SDK from OpenAPI specification')
  .option('-l, --language <lang>', 'Target language (java, typescript, python)')
  .option('-o, --output <path>', 'Output directory')
  .option('-p, --package <name>', 'Package name for the SDK')
  .action(async (options) => {
    const projectRoot = findProjectRoot();
    const config = loadConfig();
    
    if (!projectRoot || !config) {
      error('Not in a Spec-Kit project. Run "spec init <name>" first.');
      process.exit(1);
    }
    
    const language = (options.language || config.sdk?.language || 'java') as SupportedLanguage;
    const outputDir = options.output || config.sdk?.outputDir || './sdk';
    const packageName = options.package || config.sdk?.packageName || 'com.example.client';
    
    const spinner = createSpinner(`Generating ${language} SDK...`);
    spinner.start();
    
    try {
      const generator = new SDKGenerator();
      const specPath = path.join(projectRoot, config.openapi);
      const outputPath = path.join(projectRoot, outputDir);
      
      await generator.generate({
        specPath,
        outputDir: outputPath,
        language,
        packageName
      });
      
      spinner.succeed(`${language} SDK generated successfully`);
      success(`Output: ${outputDir}`);
      info('SDK is ready. Run "spec plan" to plan your implementation.');
    } catch (err) {
      spinner.fail('Failed to generate SDK');
      error(String(err));
      process.exit(1);
    }
  });

// Subcommand: generate consumer
generateCommand
  .command('consumer')
  .description('Generate consumer implementation scaffolding')
  .option('-l, --language <lang>', 'Target language (java, typescript, python)')
  .option('-o, --output <path>', 'Output directory')
  .action(async (options) => {
    const projectRoot = findProjectRoot();
    const config = loadConfig();
    
    if (!projectRoot || !config) {
      error('Not in a Spec-Kit project. Run "spec init <name>" first.');
      process.exit(1);
    }
    
    const language = (options.language || config.consumer.language) as SupportedLanguage;
    const outputDir = options.output || config.consumer.outputDir;
    const packageName = config.sdk?.packageName || 'com.example.client';
    
    const spinner = createSpinner(`Generating ${language} consumer code...`);
    spinner.start();
    
    try {
      const generator = new ConsumerGenerator();
      const specPath = path.join(projectRoot, config.openapi);
      const outputPath = options.output ? path.join(projectRoot, outputDir) : path.join(projectRoot, config.consumer.outputDir);
      
      await generator.generate({
        specPath,
        outputDir: outputPath,
        language,
        packageName
      });
      
      spinner.succeed(`${language} consumer code generated`);
      success(`Output: ${outputDir}`);
      info('Consumer scaffolding is ready. SDK methods are pre-wired.');
    } catch (err) {
      spinner.fail('Failed to generate consumer code');
      error(String(err));
      process.exit(1);
    }
  });
