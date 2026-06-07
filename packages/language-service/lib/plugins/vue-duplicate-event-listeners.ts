import type { Diagnostic, DiagnosticSeverity, LanguageServicePlugin } from '@volar/language-service';
import type * as CompilerDOM from '@vue/compiler-dom';
import { forEachElementNode } from '@vue/language-core';
import { camelize } from '@vue/shared';
import { resolveEmbeddedCode } from '../utils';

interface DuplicateEntry {
	rawName: string;
	loc: CompilerDOM.SourceLocation;
}

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-duplicate-event-listeners',
		capabilities: {
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false,
			},
		},
		create(context) {
			return {
				provideDiagnostics(document) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template') {
						return;
					}

					const { template } = info.root.ir;
					if (!template?.ast) {
						return;
					}

					const diagnostics: Diagnostic[] = [];

					for (const node of forEachElementNode(template.ast)) {
						if (node.tagType !== 1 satisfies CompilerDOM.ElementTypes.COMPONENT) {
							continue;
						}

						const seenEvents = new Map<string, DuplicateEntry[]>();

						for (const prop of node.props) {
							if (prop.type !== 7 satisfies CompilerDOM.NodeTypes.DIRECTIVE) {
								continue;
							}

							const arg = prop.arg?.type === 4 satisfies CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic
								? prop.arg
								: undefined;

							if (prop.name === 'on') {
								if (!arg) {
									continue;
								}
								const source = arg.content;
								if (source.startsWith('vue:')) {
									collect(seenEvents, camelize('onVnode-' + source.slice('vue:'.length)), source, arg.loc);
								}
								else {
									collect(seenEvents, camelize('on-' + source), source, arg.loc);
								}
							}
						}

						report(diagnostics, document, seenEvents);
					}

					return diagnostics;
				},
			};
		},
	};
}

function collect(
	seen: Map<string, DuplicateEntry[]>,
	normalizedKey: string,
	rawName: string,
	loc: CompilerDOM.SourceLocation,
) {
	let entries = seen.get(normalizedKey);
	if (!entries) {
		seen.set(normalizedKey, entries = []);
	}
	entries.push({ rawName, loc });
}

function report(
	diagnostics: Diagnostic[],
	document: { positionAt(offset: number): { line: number; character: number } },
	seen: Map<string, DuplicateEntry[]>,
) {
	for (const [, entries] of seen) {
		if (entries.length < 2) {
			continue;
		}
		for (const entry of entries.slice(1)) {
			diagnostics.push({
				range: {
					start: document.positionAt(entry.loc.start.offset),
					end: document.positionAt(entry.loc.end.offset),
				},
				severity: 1 satisfies typeof DiagnosticSeverity.Error,
				source: 'vue',
				code: 'duplicate-event-listener',
				message: 'Duplicate event listener.',
			});
		}
	}
}
