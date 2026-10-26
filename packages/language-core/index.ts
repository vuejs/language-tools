export * from './lib/compilerOptions';
export {
	allFeatures,
	completionFeatures,
	navigationFeatures,
	scriptFeatures,
	semanticFeatures,
	structureFeatures,
} from './lib/features';
export * from './lib/irPipeline';
export * from './lib/script/collectBindings';
export * from './lib/script/scriptRanges';
export * from './lib/script/scriptSetupRanges';
export * from './lib/style/styleScopedClasses';
export * from './lib/template/compile';
export * from './lib/template/elements';
export * from './lib/template/forEachTemplateNode';
export * from './lib/template/templateExpressions';
export * from './lib/template/templateScope';
export * from './lib/types';
export * from './lib/typescript/nodes';
export * from './lib/utils/buildMappings';
export * from './lib/utils/names';
export * from './lib/utils/parseSfc';
export * from './lib/utils/resolveCodeOffsets';
export * from './lib/vueSource';

export { createScriptAnalysis, getScriptLang, type ScriptAnalysis } from './lib/scriptAnalysis';

export * from '@volar/language-core';
