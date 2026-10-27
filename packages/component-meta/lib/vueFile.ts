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
 * Interim, for the prop defaults of script setup only: the declaration that a generic component exports does not
 * reach its defaults, which are local to its setup function, while those of other components are reachable through
 * the runtime `props` option. The options resolve here without the version of Vue that the content mapper resolves
 * (`target` falls back to 99 where the content mapper gives 3.6), and without its `dynamicConfig` files. Exit: the
 * defaults of a generic component are reachable from its declaration; then all defaults are read through the checker
 * and this re-parse goes.
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
