export * from './lib/formats/parseSfc';
export * from './lib/ir/irPipeline';
export * from './lib/ir/vueSource';
export * from './lib/mappings/buildMappings';
export {
	allFeatures,
	completionFeatures,
	navigationFeatures,
	scriptFeatures,
	semanticFeatures,
	structureFeatures,
} from './lib/mappings/features';
export * from './lib/mappings/resolveCodeOffsets';
export * from './lib/names';
export * from './lib/options/compilerOptions';
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

export { createScriptAnalysis, getScriptLang, type ScriptAnalysis } from './lib/ir/scriptAnalysis';

export * from '@volar/language-core';
