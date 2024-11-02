import { BaseLanguageClient, ExecuteCommandParams, ExecuteCommandRequest, TextEdit } from '@volar/vscode';
import { quickPick } from '@volar/vscode/lib/common';
import { AttrNameCasing, TagNameCasing, commands } from '@vue/language-server/lib/types';
import { reactive, useActiveTextEditor, useCommand, useDisposable, watch, watchEffect } from 'reactive-vscode';
import * as vscode from 'vscode';
import { config } from '../config';

export const attrNameCasings = reactive(new Map<string, AttrNameCasing>());
export const tagNameCasings = reactive(new Map<string, TagNameCasing>());

export async function activate(client: BaseLanguageClient, selector: vscode.DocumentSelector) {

	await client.start();

	const activeTextEditor = useActiveTextEditor();

	const statusBar = useDisposable(vscode.languages.createLanguageStatusItem('vue-name-casing', selector));
	statusBar.command = {
		title: 'Open Menu',
		command: 'vue.action.nameCasing',
	};

	watchEffect(() => {
		const document = activeTextEditor.value?.document;
		if (!document) {
			return '';
		}

		const attrNameCasing = attrNameCasings.get(document.uri.toString());
		const tagNameCasing = tagNameCasings.get(document.uri.toString());

		let text = `<`;
		if (tagNameCasing === TagNameCasing.Kebab) {
			text += `tag-name `;
		}
		else if (tagNameCasing === TagNameCasing.Pascal) {
			text += `TagName `;
		}
		else {
			text += '? ';
		}
		if (attrNameCasing === AttrNameCasing.Kebab) {
			text += `prop-name`;
		}
		else if (attrNameCasing === AttrNameCasing.Camel) {
			text += `propName`;
		}
		else {
			text += '?';
		}
		text += ' />';
		statusBar.text = text;
	});

	watch(activeTextEditor, () => {
		initialize(activeTextEditor.value?.document);
	}, {
		immediate: true
	});

	watch(config.complete, () => {
		attrNameCasings.clear();
		tagNameCasings.clear();
		initialize(activeTextEditor.value?.document);
	}, { deep: true });

	useDisposable(vscode.workspace.onDidCloseTextDocument(doc => {
		attrNameCasings.delete(doc.uri.toString());
		tagNameCasings.delete(doc.uri.toString());
	}));

	useCommand('vue.action.nameCasing', async () => {
		if (!activeTextEditor.value?.document) {
			return;
		}

		const document = activeTextEditor.value.document;
		const currentAttrNameCasing = attrNameCasings.get(document.uri.toString());
		const currentTagNameCasing = tagNameCasings.get(document.uri.toString());
		const select = await quickPick([
			{
				'1': { label: (currentTagNameCasing === TagNameCasing.Kebab ? '• ' : '') + 'Component Name Using kebab-case' },
				'2': { label: (currentTagNameCasing === TagNameCasing.Pascal ? '• ' : '') + 'Component Name Using PascalCase' },
				'3': { label: 'Convert Component Name to kebab-case' },
				'4': { label: 'Convert Component Name to PascalCase' },
			},
			{
				'5': { label: (currentAttrNameCasing === AttrNameCasing.Kebab ? '• ' : '') + 'Prop Name Using kebab-case' },
				'6': { label: (currentAttrNameCasing === AttrNameCasing.Camel ? '• ' : '') + 'Prop Name Using camelCase' },
				'7': { label: 'Convert Prop Name to kebab-case' },
				'8': { label: 'Convert Prop Name to camelCase' },
			},
		]);

		if (select === undefined) {
			return; // cancel
		}
		// tag
		if (select === '1') {
			tagNameCasings.set(document.uri.toString(), TagNameCasing.Kebab);
		}
		if (select === '2') {
			tagNameCasings.set(document.uri.toString(), TagNameCasing.Pascal);
		}
		if (select === '3') {
			await convertTag(activeTextEditor.value, TagNameCasing.Kebab);
		}
		if (select === '4') {
			await convertTag(activeTextEditor.value, TagNameCasing.Pascal);
		}
		// attr
		if (select === '5') {
			attrNameCasings.set(document.uri.toString(), AttrNameCasing.Kebab);
		}
		if (select === '6') {
			attrNameCasings.set(document.uri.toString(), AttrNameCasing.Camel);
		}
		if (select === '7') {
			await convertAttr(activeTextEditor.value, AttrNameCasing.Kebab);
		}
		if (select === '8') {
			await convertAttr(activeTextEditor.value, AttrNameCasing.Camel);
		}
	});

	async function initialize(document: vscode.TextDocument | undefined) {
		if (!document || !vscode.languages.match(selector, document)) {
			return;
		}

		let detected: Awaited<ReturnType<typeof detect>> | undefined;
		let attrNameCasing = attrNameCasings.get(document.uri.toString());
		let tagNameCasing = tagNameCasings.get(document.uri.toString());

		if (!attrNameCasing) {
			const attrNameCasingSetting = config.complete.casing.props;
			if (attrNameCasingSetting === 'kebab') {
				attrNameCasing = AttrNameCasing.Kebab;
			}
			else if (attrNameCasingSetting === 'camel') {
				attrNameCasing = AttrNameCasing.Camel;
			}
			else {
				detected ??= await detect(document);
				if (detected?.attr.length === 1) {
					attrNameCasing = detected.attr[0];
				}
				else if (attrNameCasingSetting === 'autoCamel') {
					attrNameCasing = AttrNameCasing.Camel;
				}
				else {
					attrNameCasing = AttrNameCasing.Kebab;
				}
			}
			attrNameCasings.set(document.uri.toString(), attrNameCasing);
		}

		if (!tagNameCasing) {
			const tagMode = config.complete.casing.tags;
			if (tagMode === 'kebab') {
				tagNameCasing = TagNameCasing.Kebab;
			}
			else if (tagMode === 'pascal') {
				tagNameCasing = TagNameCasing.Pascal;
			}
			else {
				detected ??= await detect(document);
				if (detected?.tag.length === 1) {
					tagNameCasing = detected.tag[0];
				}
				else {
					tagNameCasing = TagNameCasing.Pascal;
				}
			}
			tagNameCasings.set(document.uri.toString(), tagNameCasing);
		}
	}

	async function convertTag(editor: vscode.TextEditor, casing: TagNameCasing) {

		const response: TextEdit[] = await client.sendRequest(ExecuteCommandRequest.type, {
			command: casing === TagNameCasing.Kebab
				? commands.convertTagsToKebabCase
				: commands.convertTagsToPascalCase,
			arguments: [client.code2ProtocolConverter.asUri(editor.document.uri)],
		} satisfies ExecuteCommandParams);

		const edits = await client.protocol2CodeConverter.asTextEdits(response);

		if (edits) {
			editor.edit(editBuilder => {
				for (const edit of edits) {
					editBuilder.replace(edit.range, edit.newText);
				}
			});
		}

		tagNameCasings.set(editor.document.uri.toString(), casing);
	}

	async function convertAttr(editor: vscode.TextEditor, casing: AttrNameCasing) {
		const response: TextEdit[] = await client.sendRequest(ExecuteCommandRequest.type, {
			command: casing === AttrNameCasing.Kebab
				? commands.convertPropsToKebabCase
				: commands.convertPropsToCamelCase,
			arguments: [client.code2ProtocolConverter.asUri(editor.document.uri)],
		} satisfies ExecuteCommandParams);

		const edits = await client.protocol2CodeConverter.asTextEdits(response);

		if (edits) {
			editor.edit(editBuilder => {
				for (const edit of edits) {
					editBuilder.replace(edit.range, edit.newText);
				}
			});
		}

		attrNameCasings.set(editor.document.uri.toString(), casing);
	}

	function detect(document: vscode.TextDocument): Promise<{
		tag: TagNameCasing[],
		attr: AttrNameCasing[],
	}> {
		return client.sendRequest(ExecuteCommandRequest.type, {
			command: commands.detectNameCasing,
			arguments: [client.code2ProtocolConverter.asUri(document.uri)],
		} satisfies ExecuteCommandParams);
	}
}
