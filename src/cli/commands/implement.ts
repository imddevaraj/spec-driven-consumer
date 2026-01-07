/**
 * spec implement command
 * 
 * Generates consumer implementation code based on the plan
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { success, error, info, warn, createSpinner, loadConfig, findProjectRoot } from '../utils';
import { ImplementationPlan, Task } from '../../types';
import { ConsumerGenerator } from '../../core/consumer-generator';
import { Guardrails } from '../../core/guardrails';

export const implementCommand = new Command('implement')
  .description('Generate consumer implementation code from the plan')
  .option('-t, --task <id>', 'Implement a specific task by ID')
  .option('-a, --all', 'Implement all pending tasks', false)
  .option('--plan <path>', 'Path to the implementation plan', 'plan.yaml')
  .option('--dry-run', 'Show what would be generated without writing files', false)
  .action(async (options) => {
    const projectRoot = findProjectRoot();
    const config = loadConfig();
    
    if (!projectRoot || !config) {
      error('Not in a Spec-Kit project. Run "spec init <name>" first.');
      process.exit(1);
    }
    
    // Load plan
    const planPath = path.join(projectRoot, options.plan);
    if (!fs.existsSync(planPath)) {
      error('Implementation plan not found');
      info('Run "spec plan <intent>" first to create a plan');
      process.exit(1);
    }
    
    const planContent = fs.readFileSync(planPath, 'utf-8');
    const plan = yaml.load(planContent) as ImplementationPlan;
    
    // Determine which tasks to implement
    let tasksToImplement: Task[] = [];
    
    if (options.task) {
      const task = plan.tasks.find(t => t.id === options.task);
      if (!task) {
        error(`Task '${options.task}' not found in plan`);
        process.exit(1);
      }
      tasksToImplement = [task];
    } else if (options.all) {
      tasksToImplement = plan.tasks.filter(t => t.status === 'pending');
    } else {
      // Default: implement first pending task
      const pendingTask = plan.tasks.find(t => t.status === 'pending');
      if (pendingTask) {
        tasksToImplement = [pendingTask];
      }
    }
    
    if (tasksToImplement.length === 0) {
      info('No pending tasks to implement');
      console.log('');
      console.log('Current plan status:');
      plan.tasks.forEach((task, index) => {
        const statusIcon = task.status === 'completed' ? '✓' : task.status === 'in-progress' ? '◐' : '○';
        console.log(`  ${statusIcon} ${task.title}`);
      });
      process.exit(0);
    }
    
    console.log('');
    console.log('📝 Implementing tasks:');
    tasksToImplement.forEach(task => {
      console.log(`  • ${task.title}`);
    });
    console.log('');
    
    if (options.dryRun) {
      info('Dry run mode - no files will be written');
      console.log('');
    }
    
    const spinner = createSpinner('Generating consumer implementation...');
    spinner.start();
    
    try {
      const generator = new ConsumerGenerator();
      const guardrails = new Guardrails();
      
      for (const task of tasksToImplement) {
        // Update task status
        task.status = 'in-progress';
        
        // Generate consumer code for task operations
        const generatedCode = await generator.generateForOperations({
          specPath: path.join(projectRoot, config.openapi),
          outputDir: path.join(projectRoot, config.consumer.outputDir),
          language: config.consumer.language as 'java' | 'typescript' | 'python',
          packageName: config.sdk?.packageName,
          operations: task.operations
        });
        
        // Validate guardrails
        const violations = guardrails.validate(generatedCode);
        
        if (violations.length > 0) {
          spinner.warn('Guardrail violations detected');
          violations.forEach(v => {
            warn(`  ${v}`);
          });
        }
        
        if (!options.dryRun) {
          // Write generated files
          for (const [filePath, content] of Object.entries(generatedCode)) {
            const fullPath = path.join(projectRoot, config.consumer.outputDir, filePath);
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(fullPath, content);
          }
          
          // Mark task as completed
          task.status = 'completed';
        }
      }
      
      // Save updated plan
      if (!options.dryRun) {
        fs.writeFileSync(planPath, yaml.dump(plan, { indent: 2 }));
      }
      
      spinner.succeed('Consumer implementation generated');
      console.log('');
      
      success(`Generated files in: ${config.consumer.outputDir}`);
      
      // Show remaining tasks
      const remainingTasks = plan.tasks.filter(t => t.status === 'pending');
      if (remainingTasks.length > 0) {
        info(`${remainingTasks.length} task(s) remaining`);
        console.log('Run "spec implement" again to continue');
      } else {
        success('All tasks completed! 🎉');
      }
      
    } catch (err) {
      spinner.fail('Failed to generate implementation');
      error(String(err));
      process.exit(1);
    }
  });
