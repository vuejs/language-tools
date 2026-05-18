import { toGeneratedOffset } from '@volar/typescript/lib/node/transform';
import type * as CompilerDOM from '@vue/compiler-dom';
import {
	forEachElementNode,
	type Language,
	type SourceScript,
	type VueCodeInformation,
	type VueVirtualCode,
} from '@vue/language-core';
import type * as ts from 'typescript';
import { hasBooleanType } from './utils';

export interface ComponentPropInfo {
	name: string;
	description?: string;
	optional?: boolean;
	boolean?: boolean;
}

export function getComponentProps(
	ts: typeof import('typescript'),
	tsLanguageService: ts.LanguageService,
	program: ts.Program,
	language: Language,
	sourceScript: SourceScript<string>,
	virtualCode: VueVirtualCode,
	position: number,
): ComponentPropInfo[] {
	const serviceScript = sourceScript.generated!.languagePlugin.typescript?.getServiceScript(virtualCode);
	if (!serviceScript) {
		return [];
	}

	const { ir } = virtualCode;
	if (!ir.template?.ast) {
		return [];
	}

	let node: CompilerDOM.ElementNode | undefined;
	for (const child of forEachElementNode(ir.template.ast)) {
		if (position >= child.loc.start.offset) {
			node = child;
		}
	}
	if (node?.tagType !== 1 satisfies CompilerDOM.ElementTypes.COMPONENT) {
		return [];
	}

	let position2: number | undefined;
	if (node.props.some(prop => position >= prop.loc.start.offset && position <= prop.loc.end.offset)) {
		position2 = toGeneratedOffset(
			language,
			serviceScript,
			sourceScript,
			ir.template.startTagEnd + position - (
				// <Comp :foo-| /> -> { "foo"|: ... }
				ir.template.content[position - 1] === '-' ? 1 : 0
			),
			(data: VueCodeInformation) => !!data.__propsCompletion,
		);
	}
	position2 ??= toGeneratedOffset(
		language,
		serviceScript,
		sourceScript,
		ir.template.startTagEnd + node.loc.start.offset,
		(data: VueCodeInformation) => !!data.__propsCompletion,
	);
	if (!position2) {
		return [];
	}

	const checker = program.getTypeChecker();
	const completion = tsLanguageService.getCompletionsAtPosition(virtualCode.fileName, position2, {
		includeSymbol: true,
	});

	// skip fallback global completions
	if (!completion?.isMemberCompletion) {
		return [];
	}

	return completion.entries.map(entry => {
		const modifiers = entry.kindModifiers?.split(',');
		const type = entry.symbol && checker.getTypeOfSymbol(entry.symbol);

		const info: ComponentPropInfo = {
			name: entry.name.startsWith('"') && entry.name.endsWith('"')
				? entry.name.slice(1, -1)
				: entry.name,
			description: entry.symbol && (
				ts.displayPartsToString(entry.symbol.getDocumentationComment(checker))
				+ '\n\n'
				+ entry.symbol.getJsDocTags(checker).map(tag =>
					`*@${tag.name}*${tag.text?.length ? ` — ${ts.displayPartsToString(tag.text)}` : ''}`
				).join('\n\n')
			).trimEnd(),
		};
		if (modifiers?.includes('optional')) {
			info.optional = true;
		}
		if (type && hasBooleanType(ts, type)) {
			info.boolean = true;
		}
		return info;
	});
}
