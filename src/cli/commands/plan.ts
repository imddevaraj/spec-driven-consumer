/**
 * spec plan command
 * 
 * Creates implementation tasks from natural language intent
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { success, error, info, createSpinner, loadConfig, findProjectRoot, ensureDir } from '../utils';
import { OpenAPISpec, Task, ImplementationPlan } from '../../types';

export const planCommand = new Command('plan')
  .description('Create implementation tasks from natural language intent')
  .argument('<intent>', 'Natural language description of what you want to implement')
  .option('-o, --output <path>', 'Output file for the plan', 'plan.yaml')
  .action(async (intent: string, options: { output: string }) => {
    const projectRoot = findProjectRoot();
    const config = loadConfig();
    
    if (!projectRoot || !config) {
      error('Not in a Spec-Kit project. Run "spec init <name>" first.');
      process.exit(1);
    }
    
    const spinner = createSpinner('Analyzing OpenAPI spec and creating plan...');
    spinner.start();
    
    try {
      // Load OpenAPI spec
      const specPath = path.join(projectRoot, config.openapi);
      if (!fs.existsSync(specPath)) {
        spinner.fail('OpenAPI spec not found');
        error(`Expected spec at: ${config.openapi}`);
        info('Run "spec generate openapi" first');
        process.exit(1);
      }
      
      const specContent = fs.readFileSync(specPath, 'utf-8');
      const spec = yaml.load(specContent) as OpenAPISpec;
      
      // Analyze intent and map to operations
      const tasks = analyzeIntentAndCreateTasks(intent, spec);
      
      if (tasks.length === 0) {
        spinner.warn('No matching operations found in the spec');
        info('Consider updating the OpenAPI spec to include the needed endpoints');
        console.log('');
        console.log('Intent:', intent);
        console.log('Available operations:');
        listAvailableOperations(spec);
        process.exit(0);
      }
      
      // Create implementation plan
      const plan: ImplementationPlan = {
        intent,
        createdAt: new Date().toISOString(),
        tasks
      };
      
      // Save plan
      const outputPath = path.join(projectRoot, options.output);
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath, yaml.dump(plan, { indent: 2 }));
      
      spinner.succeed('Implementation plan created');
      console.log('');
      
      // Display plan
      console.log('📋 Implementation Plan');
      console.log('─'.repeat(50));
      console.log(`Intent: ${intent}`);
      console.log('');
      
      tasks.forEach((task, index) => {
        console.log(`${index + 1}. [${task.status}] ${task.title}`);
        console.log(`   ${task.description}`);
        console.log(`   Operations: ${task.operations.join(', ')}`);
        console.log('');
      });
      
      success(`Plan saved to: ${options.output}`);
      info('Run "spec implement" to generate consumer code for these tasks');
      
    } catch (err) {
      spinner.fail('Failed to create implementation plan');
      error(String(err));
      process.exit(1);
    }
  });

/**
 * Analyze intent and create tasks based on OpenAPI operations
 */
function analyzeIntentAndCreateTasks(intent: string, spec: OpenAPISpec): Task[] {
  const tasks: Task[] = [];
  const intentLower = intent.toLowerCase();
  const intentWords = intentLower.split(/\s+/);
  
  // Action keywords that map to HTTP methods
  const actionKeywords: Record<string, string[]> = {
    'create': ['create', 'add', 'new', 'make', 'post'],
    'list': ['list', 'get all', 'fetch all', 'show all', 'all'],
    'get': ['get', 'fetch', 'retrieve', 'find', 'show', 'read'],
    'update': ['update', 'modify', 'edit', 'change', 'put', 'patch'],
    'delete': ['delete', 'remove', 'destroy']
  };
  
  // Extract action types from intent
  const matchedActions = new Set<string>();
  for (const [action, keywords] of Object.entries(actionKeywords)) {
    if (keywords.some(kw => intentLower.includes(kw))) {
      matchedActions.add(action);
    }
  }
  
  // Find matching operations
  const matchedOperations: string[] = [];
  
  for (const [pathKey, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (typeof operation !== 'object' || !operation.operationId) continue;
      
      const op = operation as { operationId: string; summary?: string; tags?: string[] };
      const opId = op.operationId.toLowerCase();
      const opSummary = (op.summary || '').toLowerCase();
      const opTags = (op.tags || []).map(t => t.toLowerCase());
      const opPath = pathKey.toLowerCase();
      
      // Check 1: Direct entity match (e.g., "pets" in path or operationId)
      const entityMatch = intentWords.some(word => 
        word.length > 2 && (
          opId.includes(word) || 
          opPath.includes(word) || 
          opSummary.includes(word) ||
          opTags.some(tag => tag.includes(word))
        )
      );
      
      // Check 2: Action match (e.g., "create" matches POST, "list" matches GET all)
      let actionMatch = false;
      if (matchedActions.has('create') && method === 'post') actionMatch = true;
      if (matchedActions.has('list') && method === 'get' && !pathKey.includes('{')) actionMatch = true;
      if (matchedActions.has('get') && method === 'get') actionMatch = true;
      if (matchedActions.has('update') && (method === 'put' || method === 'patch')) actionMatch = true;
      if (matchedActions.has('delete') && method === 'delete') actionMatch = true;
      
      // Match if entity matches AND (action matches OR no specific action requested)
      if (entityMatch && (actionMatch || matchedActions.size === 0)) {
        if (!matchedOperations.includes(op.operationId)) {
          matchedOperations.push(op.operationId);
        }
      }
      
      // Also match if operationId directly contains intent words
      if (intentWords.some(word => word.length > 3 && opId.includes(word))) {
        if (!matchedOperations.includes(op.operationId)) {
          matchedOperations.push(op.operationId);
        }
      }
    }
  }
  
  // Group operations into tasks
  if (matchedOperations.length > 0) {
    tasks.push({
      id: `task-${Date.now()}`,
      title: extractTaskTitle(intent),
      description: `Implement: ${intent}`,
      status: 'pending',
      operations: matchedOperations
    });
  }
  
  return tasks;
}

function extractTaskTitle(intent: string): string {
  // Capitalize first letter and create a concise title
  const title = intent.charAt(0).toUpperCase() + intent.slice(1);
  return title.length > 50 ? title.substring(0, 47) + '...' : title;
}

function listAvailableOperations(spec: OpenAPISpec): void {
  for (const [pathKey, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (typeof operation !== 'object' || !operation.operationId) continue;
      const op = operation as { operationId: string; summary?: string };
      console.log(`  - ${method.toUpperCase()} ${pathKey}: ${op.operationId}`);
      if (op.summary) {
        console.log(`    ${op.summary}`);
      }
    }
  }
}
