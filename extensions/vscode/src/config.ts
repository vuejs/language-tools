import { defineConfigObject } from 'reactive-vscode';
import { NestedScopedConfigs, scopedConfigs } from './generated-meta';

export const config = defineConfigObject<NestedScopedConfigs>(
	scopedConfigs.scope,
	scopedConfigs.defaults
);
