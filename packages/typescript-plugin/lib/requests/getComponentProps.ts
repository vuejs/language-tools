import type * as CompilerDOM from '@vue/compiler-dom';
import type { Language, SourceScript, VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import { forEachTouchingNode } from './utils';

export interface ComponentPropInfo {
	name: string;
	required?: boolean;
	deprecated?: boolean;
	documentation?: string;
}

export function getComponentProps(
	ts: typeof import('typescript'),
	language: Language<string>,
	languageService: ts.LanguageService,
	sourceScript: SourceScript<string>,
	virtualCode: VueVirtualCode,
	position: number,
	leadingOffset: number = 0,
): ComponentPropInfo[] {
	const program = languageService.getProgram()!;
	const sourceFile = program.getSourceFile(virtualCode.fileName);
	if (!sourceFile) {
		return [];
	}

	const serviceScript = sourceScript.generated!.languagePlugin.typescript?.getServiceScript(virtualCode);
	if (!serviceScript) {
		return [];
	}

	const { template } = virtualCode.sfc;
	if (!template?.ast) {
		return [];
	}

	let mapped = false;
	const map = language.maps.get(serviceScript.code, sourceScript);

	outer: for (const [offset] of map.toGeneratedLocation(position + template.startTagEnd)) {
		for (const node of forEachTouchingNode(ts, sourceFile, offset + leadingOffset)) {
			if (ts.isObjectLiteralExpression(node)) {
				position = offset;
				if (sourceFile.text[position - 1 + leadingOffset] === "'") {
					position--;
				}
				mapped = true;
				break outer;
			}
		}
	}
	if (!mapped) {
		const templateNode = getTouchingTemplateNode(template.ast, position);
		if (!templateNode) {
			return [];
		}

		position = templateNode.loc.start.offset;
		outer: for (const [offset] of map.toGeneratedLocation(position + template.startTagEnd)) {
			for (const node of forEachTouchingNode(ts, sourceFile, offset + leadingOffset)) {
				if (
					ts.isVariableDeclaration(node)
					&& node.initializer
					&& ts.isCallExpression(node.initializer)
					&& node.initializer.arguments.length
				) {
					position = node.initializer.arguments[0]!.end - 1 - leadingOffset;
					mapped = true;
					break outer;
				}
			}
		}
		if (!mapped) {
			return [];
		}
	}

	const offset = 1145141919810;
	const mapping = {
		sourceOffsets: [offset],
		generatedOffsets: [position],
		lengths: [0],
		data: {
			completion: true,
		},
	};

	const original = map.toGeneratedLocation;
	map.toGeneratedLocation = function*(sourceOffset, ...args) {
		if (sourceOffset === offset) {
			yield [mapping.generatedOffsets[0]!, mapping];
		}
		yield* original.call(map, sourceOffset, ...args);
	};

	try {
		const completions = languageService.getCompletionsAtPosition(virtualCode.fileName, offset, undefined);

		return completions?.entries
			.filter(entry => entry.kind === 'property')
			.map(entry => {
				const modifiers = entry.kindModifiers?.split(',') ?? [];
				const details = languageService.getCompletionEntryDetails(
					virtualCode.fileName,
					offset,
					entry.name,
					undefined,
					entry.source,
					undefined,
					entry.data,
				);
				return {
					name: stripQuotes(entry.name),
					required: !modifiers.includes('optional'),
					deprecated: modifiers.includes('deprecated'),
					documentation: details ? [...generateDocumentation(ts, details)].join('') : '',
				};
			}) ?? [];
	}
	finally {
		map.toGeneratedLocation = original;
	}
}

function getTouchingTemplateNode(
	node: CompilerDOM.ParentNode,
	position: number,
): CompilerDOM.ElementNode | undefined {
	for (const child of node.children) {
		if (child.type === 1 satisfies CompilerDOM.NodeTypes.ELEMENT) {
			if (position >= child.loc.start.offset && position <= child.loc.end.offset) {
				return getTouchingTemplateNode(child, position) ?? child;
			}
		}
	}
}

function stripQuotes(str: string) {
	if (str.startsWith('"') && str.endsWith('"')) {
		return str.slice(1, -1);
	}
	return str;
}

function* generateDocumentation(
	ts: typeof import('typescript'),
	details: ts.CompletionEntryDetails,
): Generator<string> {
	if (details.displayParts.length) {
		yield `\`\`\`\n`;
		yield ts.displayPartsToString(details.displayParts);
		yield `\n\`\`\`\n\n`;
	}
	if (details.documentation) {
		yield ts.displayPartsToString(details.documentation);
		yield `\n\n`;
	}
	if (details.tags?.length) {
		for (const tag of details.tags) {
			yield `*@${tag.name}*`;
			if (tag.text?.length) {
				yield ` — ${ts.displayPartsToString(tag.text)}`;
			}
			yield `\n\n`;
		}
	}
}
