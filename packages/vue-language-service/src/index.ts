export * from '@volar/embedded-language-service';
export * from '@volar/vue-language-core';
export * from './documentService';
export { executePluginCommand, ExecutePluginCommandArgs } from './languageFeatures/executeCommand';
export { mergeWorkspaceEdits } from './languageFeatures/rename';
export * from './languageService';
export { convertTagNameCasingCommand, ConvertTagNameCasingCommandArgs } from './plugins/vue-convert-tagcasing';
export * from './types';

