export * from './lib/compilerOptions';
export {
	allFeatures,
	completionFeatures,
	navigationFeatures,
	scriptFeatures,
	semanticFeatures,
	structureFeatures,
} from './lib/features';
export * from './lib/languagePlugin';
export * from './lib/parsers/scriptRanges';
export * from './lib/parsers/scriptSetupRanges';
export * from './lib/plugins';
export * from './lib/template/compile';
export * from './lib/types';
export * from './lib/utils/buildMappings';
export * from './lib/utils/collectBindings';
export * from './lib/utils/forEachTemplateNode';
export * from './lib/utils/parseSfc';
export * from './lib/utils/shared';
export * from './lib/utils/styleScopedClasses';
export * from './lib/utils/templateExpressions';
export * from './lib/utils/templateInlayHints';
export * from './lib/utils/templateScopeNames';
export * from './lib/virtualCode';

export { getScriptAnalysis, getScriptLang } from './lib/scriptAnalysis';

export * from '@volar/language-core';
