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
