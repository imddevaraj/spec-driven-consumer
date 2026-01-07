/**
 * OpenAPI Specification Generator
 * 
 * Generates OpenAPI specs from natural language descriptions or templates
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { OpenAPISpec } from '../types';

interface EntitySpec {
  name: string;
  plural: string;
  properties: Array<{
    name: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;
}

export class SpecGenerator {
  private templates: Record<string, OpenAPISpec> = {};
  
  constructor() {
    this.initializeTemplates();
  }
  
  /**
   * Generate OpenAPI spec from natural language description
   */
  async generateFromDescription(
    description: string,
    outputPath: string,
    projectName: string
  ): Promise<void> {
    const spec = this.parseDescription(description, projectName);
    this.writeSpec(spec, outputPath);
  }
  
  /**
   * Generate OpenAPI spec from a predefined template
   */
  async generateFromTemplate(
    templateName: string,
    outputPath: string,
    projectName: string
  ): Promise<void> {
    const template = this.templates[templateName];
    if (!template) {
      throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(this.templates).join(', ')}`);
    }
    
    // Customize template with project name
    const spec = JSON.parse(JSON.stringify(template)) as OpenAPISpec;
    spec.info.title = `${projectName} API`;
    
    this.writeSpec(spec, outputPath);
  }
  
  /**
   * Parse natural language description into OpenAPI spec
   */
  private parseDescription(description: string, projectName: string): OpenAPISpec {
    const descLower = description.toLowerCase();
    
    // Extract entities from description
    const entities = this.extractEntities(descLower);
    
    // Build OpenAPI spec
    const spec: OpenAPISpec = {
      openapi: '3.0.3',
      info: {
        title: `${projectName} API`,
        version: '1.0.0',
        description: description
      },
      servers: [
        {
          url: 'http://localhost:8080/api/v1',
          description: 'Local development server'
        }
      ],
      paths: {},
      components: {
        schemas: {}
      }
    };
    
    // Generate CRUD operations for each entity
    for (const entity of entities) {
      this.addEntityPaths(spec, entity);
      this.addEntitySchema(spec, entity);
    }
    
    // Add common paths
    spec.paths['/health'] = {
      get: {
        operationId: 'getHealth',
        summary: 'Health check endpoint',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthStatus' }
              }
            }
          }
        }
      }
    };
    
    // Add common schemas
    spec.components!.schemas!['HealthStatus'] = {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['UP', 'DOWN'] },
        timestamp: { type: 'string', format: 'date-time' }
      },
      required: ['status', 'timestamp']
    };
    
    spec.components!.schemas!['Error'] = {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' }
      },
      required: ['code', 'message']
    };
    
    return spec;
  }
  
  /**
   * Extract entity names from description
   */
  private extractEntities(description: string): EntitySpec[] {
    const entities: EntitySpec[] = [];
    
    // Common entity patterns
    const entityPatterns: Record<string, EntitySpec> = {
      'user': {
        name: 'User',
        plural: 'users',
        properties: [
          { name: 'id', type: 'string', required: true },
          { name: 'email', type: 'string', required: true },
          { name: 'name', type: 'string', required: true },
          { name: 'createdAt', type: 'string', description: 'ISO 8601 timestamp' }
        ]
      },
      'pet': {
        name: 'Pet',
        plural: 'pets',
        properties: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string', required: true },
          { name: 'status', type: 'string', description: 'available, pending, sold' },
          { name: 'category', type: 'string' }
        ]
      },
      'order': {
        name: 'Order',
        plural: 'orders',
        properties: [
          { name: 'id', type: 'string', required: true },
          { name: 'status', type: 'string', required: true },
          { name: 'total', type: 'number' },
          { name: 'createdAt', type: 'string' }
        ]
      },
      'product': {
        name: 'Product',
        plural: 'products',
        properties: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string', required: true },
          { name: 'price', type: 'number', required: true },
          { name: 'description', type: 'string' }
        ]
      },
      'item': {
        name: 'Item',
        plural: 'items',
        properties: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string', required: true },
          { name: 'type', type: 'string' }
        ]
      }
    };
    
    // Find entities mentioned in description
    for (const [keyword, spec] of Object.entries(entityPatterns)) {
      if (description.includes(keyword)) {
        entities.push(spec);
      }
    }
    
    // Default to 'Resource' if no entities found
    if (entities.length === 0) {
      entities.push({
        name: 'Resource',
        plural: 'resources',
        properties: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string', required: true },
          { name: 'data', type: 'object' }
        ]
      });
    }
    
    return entities;
  }
  
  /**
   * Add CRUD paths for an entity
   */
  private addEntityPaths(spec: OpenAPISpec, entity: EntitySpec): void {
    const basePath = `/${entity.plural}`;
    const tag = entity.name;
    
    // List all
    spec.paths[basePath] = {
      get: {
        operationId: `list${entity.name}s`,
        summary: `List all ${entity.plural}`,
        tags: [tag],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Maximum number of items to return'
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Number of items to skip'
          }
        ],
        responses: {
          '200': {
            description: `List of ${entity.plural}`,
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: `#/components/schemas/${entity.name}` }
                }
              }
            }
          }
        }
      },
      post: {
        operationId: `create${entity.name}`,
        summary: `Create a new ${entity.name.toLowerCase()}`,
        tags: [tag],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${entity.name}Input` }
            }
          }
        },
        responses: {
          '201': {
            description: `${entity.name} created`,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${entity.name}` }
              }
            }
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    };
    
    // Single resource operations
    spec.paths[`${basePath}/{id}`] = {
      get: {
        operationId: `get${entity.name}`,
        summary: `Get a ${entity.name.toLowerCase()} by ID`,
        tags: [tag],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: `${entity.name} ID`
          }
        ],
        responses: {
          '200': {
            description: `${entity.name} found`,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${entity.name}` }
              }
            }
          },
          '404': {
            description: `${entity.name} not found`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      },
      put: {
        operationId: `update${entity.name}`,
        summary: `Update a ${entity.name.toLowerCase()}`,
        tags: [tag],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${entity.name}Input` }
            }
          }
        },
        responses: {
          '200': {
            description: `${entity.name} updated`,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${entity.name}` }
              }
            }
          },
          '404': {
            description: `${entity.name} not found`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      },
      delete: {
        operationId: `delete${entity.name}`,
        summary: `Delete a ${entity.name.toLowerCase()}`,
        tags: [tag],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '204': {
            description: `${entity.name} deleted`
          },
          '404': {
            description: `${entity.name} not found`,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    };
  }
  
  /**
   * Add schema definitions for an entity
   */
  private addEntitySchema(spec: OpenAPISpec, entity: EntitySpec): void {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    for (const prop of entity.properties) {
      properties[prop.name] = {
        type: prop.type,
        ...(prop.description && { description: prop.description })
      };
      if (prop.required) {
        required.push(prop.name);
      }
    }
    
    // Full entity schema
    spec.components!.schemas![entity.name] = {
      type: 'object',
      properties,
      required
    };
    
    // Input schema (without id, timestamps)
    const inputProperties = { ...properties };
    delete inputProperties['id'];
    delete inputProperties['createdAt'];
    delete inputProperties['updatedAt'];
    
    const inputRequired = required.filter(r => r !== 'id' && r !== 'createdAt' && r !== 'updatedAt');
    
    spec.components!.schemas![`${entity.name}Input`] = {
      type: 'object',
      properties: inputProperties,
      required: inputRequired
    };
  }
  
  /**
   * Write spec to file
   */
  private writeSpec(spec: OpenAPISpec, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const content = yaml.dump(spec, { 
      indent: 2,
      lineWidth: -1,
      noRefs: true
    });
    
    fs.writeFileSync(outputPath, content);
  }
  
  /**
   * Initialize predefined templates
   */
  private initializeTemplates(): void {
    this.templates['crud'] = {
      openapi: '3.0.3',
      info: {
        title: 'CRUD API',
        version: '1.0.0',
        description: 'A simple CRUD API template'
      },
      paths: {},
      components: { schemas: {} }
    };
  }
}
