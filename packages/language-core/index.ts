export * from './lib/formats/parseSfc';
export * from './lib/ir/irPipeline';
export * from './lib/ir/vueSource';
export * from './lib/mappings/codeMappings';
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
export * from './lib/script/bindingPatterns';
export * from './lib/script/scriptRanges';
export * from './lib/script/scriptSetupRanges';
export * from './lib/style/scopedClassReferences';
export * from './lib/template/compileTemplate';
export * from './lib/template/elements';
export * from './lib/template/forEachTemplateNode';
export * from './lib/template/templateExpressions';
export * from './lib/template/templateScope';
export * from './lib/types';
export * from './lib/typescript/nodes';

export { createScriptAnalysis, getScriptLang, type ScriptAnalysis } from './lib/ir/scriptAnalysis';

export * from '@volar/language-core';
