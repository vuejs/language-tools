import { defineConfigObject } from 'reactive-vscode';
import { type NestedScopedConfigs, scopedConfigs } from './generated-meta';

export const config = defineConfigObject<NestedScopedConfigs>(
	scopedConfigs.scope,
	scopedConfigs.defaults,
);
