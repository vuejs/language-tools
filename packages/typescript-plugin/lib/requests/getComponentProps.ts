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

export interface ComponentPropInfo {
	name: string;
	description: string;
	optional?: boolean;
	boolean?: boolean;
}

export function getComponentProps(
	ts: typeof import('typescript'),
	tsLanguageService: ts.LanguageService,
	session: ts.server.Session,
	language: Language,
	sourceScript: SourceScript<string>,
	virtualCode: VueVirtualCode,
	position: number,
): ComponentPropInfo[] | undefined {
	const serviceScript = sourceScript.generated!.languagePlugin.typescript?.getServiceScript(virtualCode);
	if (!serviceScript) {
		return;
	}

	const { sfc } = virtualCode;
	if (!sfc.template?.ast) {
		return;
	}

	let node: CompilerDOM.ElementNode | undefined;
	for (const child of forEachElementNode(sfc.template.ast)) {
		if (position >= child.loc.start.offset) {
			node = child;
		}
	}
	if (!node) {
		return;
	}

	let position2: number | undefined;
	if (node.props.some(prop => position >= prop.loc.start.offset && position <= prop.loc.end.offset)) {
		position2 = toGeneratedOffset(
			language,
			serviceScript,
			sourceScript,
			sfc.template.startTagEnd + position - (
				// <Comp :foo-| /> -> { "foo"|: ... }
				sfc.template.content[position - 1] === '-' ? 1 : 0
			),
			(data: VueCodeInformation) => !!data.__propsCompletion,
		);
	}
	position2 ??= toGeneratedOffset(
		language,
		serviceScript,
		sourceScript,
		sfc.template.startTagEnd + node.loc.start.offset,
		(data: VueCodeInformation) => !!data.__propsCompletion,
	);
	if (!position2) {
		return;
	}

	const preferences = session['getPreferences']();
	const completion = tsLanguageService.getCompletionsAtPosition(virtualCode.fileName, position2, preferences);

	return completion?.entries.map(entry => {
		const modifiers = entry.kindModifiers?.split(',');
		const details = tsLanguageService.getCompletionEntryDetails(
			virtualCode.fileName,
			position2,
			entry.name,
			session['getFormatOptions'](),
			entry.source,
			preferences,
			entry.data,
		);
		const info: ComponentPropInfo = {
			name: entry.name,
			description: ts.displayPartsToString(details?.documentation) + (
				details?.tags
					? '\n\n' + details.tags.map(tag => `*@${tag.name}* — ${ts.displayPartsToString(tag.text)}`).join('\n')
					: ''
			),
		};
		if (modifiers?.includes('optional')) {
			info.optional = true;
		}
		if (details?.displayParts.some((part, i) => i >= 8 && part.text === 'boolean')) {
			info.boolean = true;
		}
		return info;
	});
}
