/**
 * spec init command
 * 
 * Initializes a new Spec-Kit project with the standard structure
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { success, error, info, ensureDir, saveConfig, printBanner } from '../utils';
import { SpecKitConfig } from '../../types';

export const initCommand = new Command('init')
  .description('Initialize a new Spec-Kit project')
  .argument('<project-name>', 'Name of the project')
  .option('-l, --language <lang>', 'SDK target language', 'java')
  .action(async (projectName: string, options: { language: string }) => {
    printBanner();
    
    const projectDir = path.join(process.cwd(), projectName);
    
    if (fs.existsSync(projectDir)) {
      error(`Directory '${projectName}' already exists`);
      process.exit(1);
    }
    
    info(`Creating Spec-Kit project: ${projectName}`);
    
    // Create project structure
    ensureDir(projectDir);
    ensureDir(path.join(projectDir, 'consumer'));
    ensureDir(path.join(projectDir, '.spec-kit'));
    
    // Create default config
    const config: SpecKitConfig = {
      name: projectName,
      version: '1.0.0',
      openapi: './openapi.yaml',
      // SDK config removed as we use direct REST client generation
      consumer: {
        language: options.language,
        outputDir: './consumer'
      }
    };
    
    saveConfig(config, projectDir);
    
    // Create placeholder OpenAPI spec
    const openapiTemplate = `openapi: "3.0.3"
info:
  title: ${projectName} API
  version: "1.0.0"
  description: |
    API specification for ${projectName}.
    
    This is the single source of truth for the API.
    If something is missing, update this spec first.

servers:
  - url: http://localhost:8080/api/v1
    description: Local development server

paths:
  /health:
    get:
      operationId: getHealth
      summary: Health check endpoint
      tags:
        - System
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthStatus'

components:
  schemas:
    HealthStatus:
      type: object
      properties:
        status:
          type: string
          enum: [UP, DOWN]
        timestamp:
          type: string
          format: date-time
      required:
        - status
        - timestamp
`;
    
    fs.writeFileSync(path.join(projectDir, 'openapi.yaml'), openapiTemplate);
    
    // Create .gitignore
    const gitignore = `# Dependencies
node_modules/

# Generated
consumer/generated/

# IDE
.idea/
.vscode/
*.iml

# Build
dist/
target/
*.class

# Project
plan.yaml
`;
    
    fs.writeFileSync(path.join(projectDir, '.gitignore'), gitignore);
    
    // Create README
    const readme = `# ${projectName}

A Spec-Kit managed API client project.

## Quick Start

\`\`\`bash
# 1. Sync OpenAPI spec from provider
spec sync --url <provider-url>

# 2. Plan implementation
spec plan "Implement user authentication"

# 3. Generate client code
spec implement
\`\`\`

## Project Structure

\`\`\`
${projectName}/
├── openapi.yaml       # OpenAPI source of truth
├── plan.yaml          # Implementation plan (generated)
├── consumer/          # Generated client code
└── spec-kit.yaml      # Project configuration
\`\`\`

## Workflow

1. **Specify** - Define or sync the OpenAPI spec
2. **Plan** - Create implementation tasks from natural language intent
3. **Tasks** - Review and approve the generated tasks
4. **Implement** - Generate consumer code

> ⚠️ No manual HTTP calls allowed. Always use the generated client.
`;
    
    fs.writeFileSync(path.join(projectDir, 'README.md'), readme);
    
    success(`Project '${projectName}' created successfully!`);
    console.log('');
    info('Next steps:');
    console.log(`  cd ${projectName}`);
    console.log('  spec generate openapi --from "your API description"');
    console.log('  spec generate sdk');
    console.log('');
  });
