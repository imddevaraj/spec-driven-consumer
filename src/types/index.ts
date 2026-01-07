/**
 * Spec-Kit Type Definitions
 */

export interface SpecKitConfig {
  name: string;
  version: string;
  openapi: string;
  sdk?: {
    language: string;
    outputDir: string;
    packageName?: string;
  };
  consumer: {
    language: string;
    outputDir: string;
  };
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
}

export interface Operation {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
}

export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema: SchemaObject;
  description?: string;
}

export interface RequestBody {
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface MediaType {
  schema: SchemaObject;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  $ref?: string;
  enum?: string[];
  description?: string;
}

export interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  in?: string;
  name?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  operations: string[];
}

export interface ImplementationPlan {
  tasks: Task[];
  intent: string;
  createdAt: string;
}

export type SupportedLanguage = 'java' | 'typescript' | 'python';

export interface GenerateOptions {
  language?: SupportedLanguage;
  outputDir?: string;
  packageName?: string;
}
