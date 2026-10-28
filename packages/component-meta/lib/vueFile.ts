import {
	createIRPipeline,
	createVueSource,
	type RawVueCompilerOptions,
	resolveVueCompilerOptions,
	type TypeScript as CoreTypeScript,
} from '@vue/language-core';
import { posix as path } from 'path-browserify';
import type { SourceFile } from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { Project } from 'typescript/async' with { 'resolution-mode': 'import' };

interface ContentMapperEntry {
	extensions?: string[];
	options?: RawVueCompilerOptions;
}

/**
 * language-core's reading of the source text of `sourceFile`, a file that a content mapper of `project` maps, under
 * the options of its `contentMappers` entry. `parser` parses the script blocks.
 *
 * Interim, for the prop defaults of script setup only. The defaults are source text that Vue hoists out of setup into
 * the component options, so reading them from the source is what Vue does. Vue's types carry defaults only as the
 * `Defaults` of an options component, which the declaration of other components reaches through the runtime `props`
 * option. A generic component cannot be an options component, so it is typed as a function, and Vue's function form of
 * `defineComponent` fixes `Defaults` to `{}`; its template ref types only its exposed. So no type that the declaration
 * of a generic component has needs its defaults, and reaching them would take a member, a name or a change of the
 * exported type that only component meta needs. The options resolve here without the version of Vue that the content
 * mapper resolves (`target` falls back to 99 where the content mapper gives 3.6), and without its `dynamicConfig`
 * files. Exit: Vue's types give a generic component its defaults; then all defaults are read through the checker and
 * this re-parse goes.
 */
export function getVueFile(parser: CoreTypeScript, project: Project, sourceFile: SourceFile) {
	if (!sourceFile.contentMapper) {
		return;
	}
	const { fileName, originalText } = sourceFile;
	const entries = (project.parsedCommandLine.raw as { contentMappers?: ContentMapperEntry[] } | undefined)
		?.contentMappers;
	const entry = entries?.find(entry => entry.extensions?.some(extension => fileName.endsWith(extension)));
	const vueCompilerOptions = resolveVueCompilerOptions(
		() => undefined,
		path.dirname(project.configFileName ?? fileName),
		entry?.options,
	);
	const snapshot = {
		getText: (start: number, end: number) => originalText.slice(start, end),
		getLength: () => originalText.length,
		getChangeRange: () => undefined,
	};
	return createVueSource(parser, vueCompilerOptions, createIRPipeline(parser, vueCompilerOptions), fileName, snapshot);
}
