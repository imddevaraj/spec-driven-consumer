/**
 * Spec-Kit Library Entry Point
 * 
 * Exports all core functionality for programmatic usage
 */

// Core generators
export { SpecGenerator } from './core/spec-generator';
export { SDKGenerator, SDKGeneratorOptions } from './core/sdk-generator';
export { ConsumerGenerator, ConsumerGeneratorOptions } from './core/consumer-generator';
export { Guardrails, GuardrailViolation } from './core/guardrails';

// Types
export * from './types';

// Re-export CLI utilities for extension
export {
  loadConfig,
  saveConfig,
  findProjectRoot,
  ensureDir
} from './cli/utils';
