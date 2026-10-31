import { defineConfig } from 'reactive-vscode';
import { type NestedScopedConfigs, scopedConfigs } from './generatedMeta';

export const config = defineConfig<NestedScopedConfigs>(scopedConfigs.scope);
