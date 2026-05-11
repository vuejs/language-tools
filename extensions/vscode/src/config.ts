import { defineConfig } from 'reactive-vscode';
import { type NestedScopedConfigs, scopedConfigs } from './generated-meta';

export const config = defineConfig<NestedScopedConfigs>(scopedConfigs.scope);
