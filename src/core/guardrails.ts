/**
 * Guardrails
 * 
 * Enforces spec-driven development rules:
 * - No manual HTTP calls in consumer code
 * - SDK must be used for all API interactions
 * - Spec must be updated before implementation
 */

export interface GuardrailViolation {
  rule: string;
  message: string;
  file?: string;
  line?: number;
}

export class Guardrails {
  private rules: Array<{
    name: string;
    pattern: RegExp;
    message: string;
    languages?: string[];
    skipPatterns?: RegExp[];
  }> = [
    {
      name: 'no-fetch',
      pattern: /\bfetch\s*\(/,
      message: 'Direct fetch() calls are not allowed. Use the SDK instead.',
      languages: ['typescript', 'javascript']
    },
    {
      name: 'no-axios',
      pattern: /\baxios\s*[\.\(]/,
      message: 'Direct axios calls are not allowed. Use the SDK instead.',
      languages: ['typescript', 'javascript']
    },
    {
      name: 'no-http-client',
      pattern: /new\s+HttpClient\s*\(/,
      message: 'Direct HttpClient usage is not allowed. Use the SDK instead.',
      languages: ['java']
    },
    {
      name: 'no-okhttp-direct',
      pattern: /new\s+OkHttpClient\s*\(/,
      message: 'Direct OkHttpClient usage is not allowed. Use the SDK instead.',
      languages: ['java']
    },
    {
      name: 'no-requests',
      pattern: /requests\.(get|post|put|delete|patch)\s*\(/,
      message: 'Direct requests calls are not allowed. Use the SDK instead.',
      languages: ['python']
    },
    {
      name: 'no-urllib',
      pattern: /urllib\.(request|urlopen)/,
      message: 'Direct urllib usage is not allowed. Use the SDK instead.',
      languages: ['python']
    },
    {
      name: 'no-raw-url',
      pattern: /["'](https?:\/\/[^"']+)["']/,
      message: 'Hardcoded URLs detected. API calls should go through the SDK.',
      // Skip SDK config, XML namespaces, schema locations
      skipPatterns: [
        /xmlns/i,
        /xsi:/i,
        /schema/i,
        /setBasePath/,
        /basePath/,
        /Configuration\s*\(/
      ]
    }
  ];
  
  /**
   * Validate generated code against guardrails
   */
  validate(files: Record<string, string>): string[] {
    const violations: string[] = [];
    
    for (const [filePath, content] of Object.entries(files)) {
      // Skip XML files entirely (pom.xml, etc.)
      if (filePath.endsWith('.xml') || filePath.endsWith('.pom')) {
        continue;
      }
      
      const language = this.inferLanguage(filePath);
      const fileViolations = this.validateFile(content, language, filePath);
      violations.push(...fileViolations);
    }
    
    return violations;
  }
  
  /**
   * Validate a single file
   */
  validateFile(content: string, language: string, filePath?: string): string[] {
    const violations: string[] = [];
    const lines = content.split('\n');
    
    for (const rule of this.rules) {
      // Skip rules not applicable to this language
      if (rule.languages && !rule.languages.includes(language)) {
        continue;
      }
      
      // Check each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip comments
        if (this.isComment(line, language)) {
          continue;
        }
        
        // Check if line matches the violation pattern
        if (rule.pattern.test(line)) {
          // Check if any skip pattern matches (allowed exceptions)
          const shouldSkip = rule.skipPatterns?.some(skip => skip.test(line)) ?? false;
          
          if (!shouldSkip) {
            const location = filePath ? `${filePath}:${i + 1}` : `line ${i + 1}`;
            violations.push(`[${rule.name}] ${location}: ${rule.message}`);
          }
        }
      }
    }
    
    return violations;
  }
  
  /**
   * Validate an entire directory
   */
  validateDirectory(dirPath: string): GuardrailViolation[] {
    const fs = require('fs');
    const path = require('path');
    const violations: GuardrailViolation[] = [];
    
    const walkDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip common non-source directories
          if (!['node_modules', 'dist', 'build', 'target', '.git'].includes(file)) {
            walkDir(fullPath);
          }
        } else if (this.isSourceFile(file)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const language = this.inferLanguage(file);
          const fileViolations = this.validateFile(content, language, fullPath);
          
          for (const msg of fileViolations) {
            violations.push({
              rule: msg.split(']')[0].replace('[', ''),
              message: msg,
              file: fullPath
            });
          }
        }
      }
    };
    
    if (fs.existsSync(dirPath)) {
      walkDir(dirPath);
    }
    
    return violations;
  }
  
  /**
   * Check if a file is a source file
   */
  private isSourceFile(filename: string): boolean {
    const extensions = ['.java', '.ts', '.tsx', '.js', '.jsx', '.py'];
    return extensions.some(ext => filename.endsWith(ext));
  }
  
  /**
   * Infer language from file path
   */
  private inferLanguage(filePath: string): string {
    if (filePath.endsWith('.java')) return 'java';
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return 'typescript';
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) return 'javascript';
    if (filePath.endsWith('.py')) return 'python';
    return 'unknown';
  }
  
  /**
   * Check if a line is a comment
   */
  private isComment(line: string, language: string): boolean {
    const trimmed = line.trim();
    
    switch (language) {
      case 'java':
      case 'typescript':
      case 'javascript':
        return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
      case 'python':
        return trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''");
      default:
        return false;
    }
  }
  
  /**
   * Generate a guardrails report
   */
  generateReport(violations: GuardrailViolation[]): string {
    if (violations.length === 0) {
      return `
╔═══════════════════════════════════════════════════════════╗
║           ✓ GUARDRAILS CHECK PASSED                       ║
║                                                           ║
║   No violations detected.                                 ║
║   All code follows spec-driven development principles.    ║
╚═══════════════════════════════════════════════════════════╝
`;
    }
    
    let report = `
╔═══════════════════════════════════════════════════════════╗
║           ✗ GUARDRAILS CHECK FAILED                       ║
║                                                           ║
║   ${violations.length} violation(s) detected.                           ║
╚═══════════════════════════════════════════════════════════╝

`;
    
    const byRule = new Map<string, GuardrailViolation[]>();
    for (const v of violations) {
      const list = byRule.get(v.rule) || [];
      list.push(v);
      byRule.set(v.rule, list);
    }
    
    for (const [rule, vs] of byRule) {
      report += `\n[${rule}] - ${vs.length} occurrence(s)\n`;
      report += '─'.repeat(50) + '\n';
      for (const v of vs) {
        report += `  • ${v.file || 'unknown'}\n`;
      }
    }
    
    report += `
╔═══════════════════════════════════════════════════════════╗
║   FIX: Remove direct HTTP calls and use the SDK instead.  ║
║   All API interactions must go through the generated SDK. ║
╚═══════════════════════════════════════════════════════════╝
`;
    
    return report;
  }
}
