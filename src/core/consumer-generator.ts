/**
 * Consumer Code Generator
 * 
 * Generates consumer implementation code that uses the SDK
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Handlebars from 'handlebars';
import { OpenAPISpec, SupportedLanguage, Operation } from '../types';

export interface ConsumerGeneratorOptions {
  specPath: string;
  outputDir: string;
  language: SupportedLanguage;
  packageName?: string;
  operations?: string[];
}

interface OperationContext {
  operationId: string;
  method: string;
  path: string;
  summary: string;
  hasBody: boolean;
  hasParams: boolean;
  params: Array<{ name: string; type: string; in: string }>;
  returnType: string;
}

export class ConsumerGenerator {
  private templates: Record<SupportedLanguage, Record<string, HandlebarsTemplateDelegate>> = {
    java: {},
    typescript: {},
    python: {}
  };
  
  constructor() {
    this.initializeTemplates();
  }
  
  /**
   * Generate consumer code for all operations
   */
  async generate(options: ConsumerGeneratorOptions): Promise<Record<string, string>> {
    return this.generateForOperations({
      ...options,
      operations: undefined // Generate for all operations
    });
  }
  
  /**
   * Generate consumer code for specific operations
   */
  async generateForOperations(
    options: ConsumerGeneratorOptions & { operations?: string[] }
  ): Promise<Record<string, string>> {
    // Load OpenAPI spec
    if (!fs.existsSync(options.specPath)) {
      throw new Error(`OpenAPI spec not found: ${options.specPath}`);
    }
    
    const specContent = fs.readFileSync(options.specPath, 'utf-8');
    const spec = yaml.load(specContent) as OpenAPISpec;
    
    // Extract operations
    const operations = this.extractOperations(spec, options.operations);
    
    if (operations.length === 0) {
      throw new Error('No operations found in the spec');
    }
    
    // Generate code for the target language
    const generatedFiles = this.generateForLanguage(options.language, operations, {
      packageName: options.packageName || 'com.example.client',
      apiClassName: this.deriveApiClassName(spec.info.title)
    });
    
    // Write files if outputDir is specified
    if (options.outputDir) {
      if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
      }
      
      for (const [filePath, content] of Object.entries(generatedFiles)) {
        const fullPath = path.join(options.outputDir, filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content);
      }
    }
    
    return generatedFiles;
  }
  
  /**
   * Extract operations from OpenAPI spec
   */
  private extractOperations(spec: OpenAPISpec, filterOperationIds?: string[]): OperationContext[] {
    const operations: OperationContext[] = [];
    
    for (const [pathKey, pathItem] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation !== 'object' || !operation.operationId) continue;
        
        const op = operation as Operation;
        
        // Filter by operation IDs if specified
        if (filterOperationIds && !filterOperationIds.includes(op.operationId)) {
          continue;
        }
        
        const params = (op.parameters || []).map(p => ({
          name: p.name,
          type: this.schemaToType(p.schema),
          in: p.in
        }));
        
        operations.push({
          operationId: op.operationId,
          method: method.toUpperCase(),
          path: pathKey,
          summary: op.summary || op.operationId,
          hasBody: !!op.requestBody,
          hasParams: params.length > 0,
          params,
          returnType: this.inferReturnType(op)
        });
      }
    }
    
    return operations;
  }
  
  /**
   * Generate code for a specific language
   */
  private generateForLanguage(
    language: SupportedLanguage,
    operations: OperationContext[],
    context: { packageName: string; apiClassName: string }
  ): Record<string, string> {
    const files: Record<string, string> = {};
    
    switch (language) {
      case 'java':
        files['src/main/java/Application.java'] = this.generateJavaApplication(operations, context);
        files['src/main/java/ApiService.java'] = this.generateJavaService(operations, context);
        files['pom.xml'] = this.generateJavaPom(context);
        break;
        
      case 'typescript':
        files['src/index.ts'] = this.generateTypeScriptIndex(operations, context);
        files['src/api-service.ts'] = this.generateTypeScriptService(operations, context);
        files['package.json'] = this.generateTypeScriptPackage(context);
        break;
        
      case 'python':
        files['main.py'] = this.generatePythonMain(operations, context);
        files['api_service.py'] = this.generatePythonService(operations, context);
        files['requirements.txt'] = 'requests>=2.28.0\n';
        break;
    }
    
    return files;
  }
  
  // === Java Generation (Direct REST Client) ===
  
  private generateJavaApplication(ops: OperationContext[], ctx: { packageName: string; apiClassName: string }): string {
    const operationCalls = ops.map(op => {
      const params = op.params.filter(p => p.in === 'path').map(p => `"example-${p.name}"`).join(', ');
      return `        // ${op.summary}\n        // ${op.returnType !== 'void' ? `var result = ` : ''}apiClient.${op.operationId}(${params});`;
    }).join('\n\n');
    
    return `/**
 * REST Client Application
 * 
 * Generated by Origo-Spec-Kit from OpenAPI specification.
 * This code contains complete HTTP client implementation.
 */
package client;

public class Application {
    
    private final ApiClient apiClient;
    
    public Application(String baseUrl) {
        this.apiClient = new ApiClient(baseUrl);
    }
    
    public static void main(String[] args) {
        String baseUrl = args.length > 0 ? args[0] : "http://localhost:3000/api/v1";
        Application app = new Application(baseUrl);
        app.run();
    }
    
    public void run() {
        System.out.println("REST Client Application Started");
        System.out.println("Base URL: " + apiClient.getBaseUrl());
        System.out.println();
        
        try {
            // Available operations:
${operationCalls}
            
            System.out.println();
            System.out.println("REST Client Application Finished");
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    public ApiClient getApiClient() {
        return apiClient;
    }
}
`;
  }
  
  private generateJavaService(ops: OperationContext[], ctx: { packageName: string; apiClassName: string }): string {
    const methods = ops.map(op => {
      // Build path with substitutions
      const pathParams = op.params.filter(p => p.in === 'path');
      const queryParams = op.params.filter(p => p.in === 'query');
      
      const methodParams: string[] = [];
      pathParams.forEach(p => methodParams.push(`String ${p.name}`));
      queryParams.forEach(p => methodParams.push(`${this.toJavaType(p.type)} ${p.name}`));
      if (op.hasBody) methodParams.push('Object requestBody');
      
      const paramList = methodParams.join(', ');
      
      // Path building
      let pathCode = `String path = "${op.path}"`;
      pathParams.forEach(p => {
        pathCode += `.replace("{${p.name}}", ${p.name})`;
      });
      pathCode += ';';
      
      // Query params
      let queryCode = '';
      if (queryParams.length > 0) {
        queryCode = `
        StringBuilder query = new StringBuilder();
${queryParams.map((p, i) => `        if (${p.name} != null) {
            query.append(${i === 0 ? '""' : '"&"'}).append("${p.name}=").append(${p.name});
        }`).join('\n')}
        if (query.length() > 0) {
            path += "?" + query.toString();
        }`;
      }
      
      const returnStatement = op.returnType !== 'void' 
        ? `return sendRequest("${op.method}", path, ${op.hasBody ? 'requestBody' : 'null'});`
        : `sendRequest("${op.method}", path, ${op.hasBody ? 'requestBody' : 'null'});\n        return;`;
      
      return `
    /**
     * ${op.summary}
     * ${op.method} ${op.path}
     */
    public ${op.returnType === 'void' ? 'void' : 'String'} ${op.operationId}(${paramList}) throws Exception {
        ${pathCode}${queryCode}
        ${returnStatement}
    }`;
    }).join('\n');
    
    return `/**
 * REST API Client
 * 
 * Generated by Origo-Spec-Kit from OpenAPI specification.
 * Complete HTTP client implementation using Java HttpClient.
 */
package client;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

public class ApiClient {
    
    private final String baseUrl;
    private final HttpClient httpClient;
    private final Gson gson;
    
    public ApiClient(String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
        this.gson = new GsonBuilder().setPrettyPrinting().create();
    }
    
    public String getBaseUrl() {
        return baseUrl;
    }
    
    /**
     * Send HTTP request and return response body
     */
    private String sendRequest(String method, String path, Object body) throws Exception {
        String url = baseUrl + path;
        
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(30))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json");
        
        HttpRequest.BodyPublisher bodyPublisher = body != null 
            ? HttpRequest.BodyPublishers.ofString(gson.toJson(body))
            : HttpRequest.BodyPublishers.noBody();
        
        switch (method.toUpperCase()) {
            case "GET":
                requestBuilder.GET();
                break;
            case "POST":
                requestBuilder.POST(bodyPublisher);
                break;
            case "PUT":
                requestBuilder.PUT(bodyPublisher);
                break;
            case "DELETE":
                requestBuilder.DELETE();
                break;
            case "PATCH":
                requestBuilder.method("PATCH", bodyPublisher);
                break;
            default:
                throw new IllegalArgumentException("Unsupported HTTP method: " + method);
        }
        
        HttpResponse<String> response = httpClient.send(
            requestBuilder.build(),
            HttpResponse.BodyHandlers.ofString()
        );
        
        int statusCode = response.statusCode();
        String responseBody = response.body();
        
        if (statusCode >= 200 && statusCode < 300) {
            return responseBody;
        } else if (statusCode == 204) {
            return null;
        } else {
            throw new RuntimeException("HTTP " + statusCode + ": " + responseBody);
        }
    }
${methods}
    
    /**
     * Parse JSON response to object
     */
    public <T> T parseResponse(String json, Class<T> clazz) {
        return gson.fromJson(json, clazz);
    }
}
`;
  }
  
  private generateJavaPom(ctx: { packageName: string }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>client</groupId>
    <artifactId>rest-client</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    
    <name>REST API Client</name>
    <description>Generated REST client from OpenAPI specification</description>
    
    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    
    <dependencies>
        <!-- JSON processing -->
        <dependency>
            <groupId>com.google.code.gson</groupId>
            <artifactId>gson</artifactId>
            <version>2.10.1</version>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
            </plugin>
            <plugin>
                <groupId>org.codehaus.mojo</groupId>
                <artifactId>exec-maven-plugin</artifactId>
                <version>3.1.0</version>
                <configuration>
                    <mainClass>client.Application</mainClass>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
`;
  }
  
  // === TypeScript Generation ===
  
  private generateTypeScriptIndex(ops: OperationContext[], ctx: { apiClassName: string }): string {
    return `/**
 * Generated Consumer Application
 * Uses the generated SDK - no manual HTTP calls allowed.
 */

import { ApiService } from './api-service';

async function main() {
  const apiService = new ApiService('http://localhost:8080/api/v1');
  
  console.log('Consumer Application Started');
  
  // Available operations:
${ops.map(op => `  // await apiService.${op.operationId}(...);`).join('\n')}
  
  console.log('Consumer Application Finished');
}

main().catch(console.error);
`;
  }
  
  private generateTypeScriptService(ops: OperationContext[], ctx: { apiClassName: string }): string {
    const methods = ops.map(op => {
      const params = op.params.map(p => `${p.name}: ${this.toTypeScriptType(p.type)}`).join(', ');
      return `
  /**
   * ${op.summary}
   * ${op.method} ${op.path}
   */
  async ${op.operationId}(${params}): Promise<${op.returnType}> {
    return this.api.${op.operationId}(${op.params.map(p => p.name).join(', ')});
  }`;
    }).join('\n');
    
    return `/**
 * API Service - Facade for SDK operations
 */

import { Configuration, ${ctx.apiClassName}Api } from '../sdk';

export class ApiService {
  private api: ${ctx.apiClassName}Api;
  
  constructor(basePath: string) {
    const config = new Configuration({ basePath });
    this.api = new ${ctx.apiClassName}Api(config);
  }
${methods}
}
`;
  }
  
  private generateTypeScriptPackage(ctx: { apiClassName: string }): string {
    return `{
  "name": "api-consumer",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@sdk/client": "file:../sdk"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
`;
  }
  
  // === Python Generation ===
  
  private generatePythonMain(ops: OperationContext[], ctx: { apiClassName: string }): string {
    return `"""
Generated Consumer Application
Uses the generated SDK - no manual HTTP calls allowed.
"""

from api_service import ApiService


def main():
    api_service = ApiService("http://localhost:8080/api/v1")
    
    print("Consumer Application Started")
    
    # Available operations:
${ops.map(op => `    # api_service.${this.toSnakeCase(op.operationId)}(...)`).join('\n')}
    
    print("Consumer Application Finished")


if __name__ == "__main__":
    main()
`;
  }
  
  private generatePythonService(ops: OperationContext[], ctx: { apiClassName: string }): string {
    const methods = ops.map(op => {
      const params = op.params.map(p => `${this.toSnakeCase(p.name)}: ${this.toPythonType(p.type)}`).join(', ');
      return `
    def ${this.toSnakeCase(op.operationId)}(self${params ? ', ' + params : ''}):
        """
        ${op.summary}
        ${op.method} ${op.path}
        """
        return self.api.${this.toSnakeCase(op.operationId)}(${op.params.map(p => this.toSnakeCase(p.name)).join(', ')})`;
    }).join('\n');
    
    return `"""
API Service - Facade for SDK operations
All API interactions MUST go through this service.
"""

from sdk_client import ApiClient, ${ctx.apiClassName}Api


class ApiService:
    def __init__(self, base_path: str):
        client = ApiClient()
        client.configuration.host = base_path
        self.api = ${ctx.apiClassName}Api(client)
${methods}
`;
  }
  
  // === Helpers ===
  
  private schemaToType(schema: any): string {
    if (!schema) return 'any';
    if (schema.type === 'integer') return 'number';
    if (schema.type === 'array') return 'array';
    return schema.type || 'any';
  }
  
  private inferReturnType(op: Operation): string {
    const successResponse = op.responses['200'] || op.responses['201'];
    if (!successResponse || !successResponse.content) return 'void';
    
    const jsonContent = successResponse.content['application/json'];
    if (!jsonContent || !jsonContent.schema) return 'Object';
    
    if (jsonContent.schema.$ref) {
      return jsonContent.schema.$ref.split('/').pop() || 'Object';
    }
    
    return 'Object';
  }
  
  private deriveApiClassName(title: string): string {
    return title
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^./, char => char.toUpperCase()) || 'Default';
  }
  
  private toJavaType(type: string): string {
    switch (type) {
      case 'number': return 'Integer';
      case 'string': return 'String';
      case 'boolean': return 'Boolean';
      case 'array': return 'List<?>';
      default: return 'Object';
    }
  }
  
  private toTypeScriptType(type: string): string {
    switch (type) {
      case 'number': return 'number';
      case 'string': return 'string';
      case 'boolean': return 'boolean';
      case 'array': return 'any[]';
      default: return 'any';
    }
  }
  
  private toPythonType(type: string): string {
    switch (type) {
      case 'number': return 'int';
      case 'string': return 'str';
      case 'boolean': return 'bool';
      case 'array': return 'list';
      default: return 'any';
    }
  }
  
  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
  
  private initializeTemplates(): void {
    // Templates can be extended here
  }
}
