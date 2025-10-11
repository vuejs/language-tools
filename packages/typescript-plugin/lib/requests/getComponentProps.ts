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
	const serviceScript = sourceScript.generated!.languagePlugin.typescript?.getServiceScript(virtualCode);
	if (!serviceScript) {
		return [];
	}

	let mapped = false;
	const map = language.maps.get(serviceScript.code, sourceScript);
	for (const [position2, mapping] of map.toGeneratedLocation(position)) {
		if (mapping.lengths.length === 2 && mapping.lengths.every(length => length === 0)) {
			position = position2;
			mapped = true;
			break;
		}
	}
	if (!mapped) {
		return [];
	}

	const program = languageService.getProgram()!;
	const sourceFile = program.getSourceFile(virtualCode.fileName);
	if (!sourceFile) {
		return [];
	}

	let node: ts.ObjectLiteralExpression | undefined;
	for (const child of forEachTouchingNode(ts, sourceFile, position + leadingOffset)) {
		if (ts.isObjectLiteralExpression(child)) {
			node = child;
		}
	}
	if (!node) {
		return [];
	}

	const shadowOffset = 1145141919810;
	const shadowMapping = {
		sourceOffsets: [shadowOffset],
		generatedOffsets: [node.end - 1 - leadingOffset],
		lengths: [0],
		data: {
			completion: true,
		},
	};

	const original = map.toGeneratedLocation;
	map.toGeneratedLocation = function*(sourceOffset, ...args) {
		if (sourceOffset === shadowOffset) {
			yield [shadowMapping.generatedOffsets[0]!, shadowMapping];
		}
		else {
			yield* original(sourceOffset, ...args);
		}
	};

	const completions = languageService.getCompletionsAtPosition(virtualCode.fileName, shadowOffset, undefined);
	const properties = completions?.entries.filter(entry => entry.kind === 'property') ?? [];
	const result: ComponentPropInfo[] = [];

	for (const entry of properties) {
		const details = languageService.getCompletionEntryDetails(
			virtualCode.fileName,
			shadowOffset,
			entry.name,
			undefined,
			entry.source,
			undefined,
			entry.data,
		);
		const modifiers = entry.kindModifiers?.split(',') ?? [];
		result.push({
			name: stripQuotes(entry.name),
			required: !modifiers.includes('optional'),
			deprecated: modifiers.includes('deprecated'),
			documentation: details ? [...generateDocumentation(ts, details)].join('') : '',
		});
	}
	map.toGeneratedLocation = original;

	return result;
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
