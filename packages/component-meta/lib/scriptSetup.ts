import * as core from '@vue/language-core';
import type * as ts from 'typescript';

export function getDefaultsFromScriptSetup(
	ts: typeof import('typescript'),
	printer: ts.Printer,
	language: core.Language<string>,
	componentPath: string,
) {
	const sourceScript = language.scripts.get(componentPath);
	const virtualCode = sourceScript?.generated?.root as core.VueVirtualCode | undefined;
	if (!virtualCode) {
		return;
	}
	const sourceFile = virtualCode.sfc.scriptSetup?.ast;
	if (!sourceFile) {
		return;
	}
	const scriptSetupRanges = core.parseScriptSetupRanges(ts, sourceFile, virtualCode.vueCompilerOptions);
	if (scriptSetupRanges) {
		return collectPropDefaultsFromScriptSetup(
			ts,
			printer,
			sourceFile,
			scriptSetupRanges,
		);
	}
}

function collectPropDefaultsFromScriptSetup(
	ts: typeof import('typescript'),
	printer: ts.Printer,
	sourceFile: ts.SourceFile,
	scriptSetupRanges: core.ScriptSetupRanges,
) {
	const result = new Map<string, string>();

	if (scriptSetupRanges.withDefaults?.arg) {
		const obj = findObjectLiteralExpression(ts, scriptSetupRanges.withDefaults.arg.node);
		if (obj) {
			for (const prop of obj.properties) {
				if (ts.isPropertyAssignment(prop)) {
					const name = prop.name.getText(sourceFile);
					const expNode = resolveDefaultOptionExpression(ts, prop.initializer);
					const expText = printer.printNode(ts.EmitHint.Expression, expNode, sourceFile);
					result.set(name, expText);
				}
			}
		}
	}
	else if (scriptSetupRanges.defineProps?.destructured) {
		for (const [name, initializer] of scriptSetupRanges.defineProps.destructured) {
			if (initializer) {
				const expText = printer.printNode(ts.EmitHint.Expression, initializer, sourceFile);
				result.set(name, expText);
			}
		}
	}

	if (scriptSetupRanges.defineModel) {
		for (const defineModel of scriptSetupRanges.defineModel) {
			const obj = defineModel.arg ? findObjectLiteralExpression(ts, defineModel.arg.node) : undefined;
			if (obj) {
				const name = defineModel.name
					? sourceFile.text.slice(defineModel.name.start, defineModel.name.end).slice(1, -1)
					: 'modelValue';
				const _default = resolveModelOption(ts, printer, sourceFile, obj);
				if (_default) {
					result.set(name, _default);
				}
			}
		}
	}

	return result;
}

function findObjectLiteralExpression(
	ts: typeof import('typescript'),
	node: ts.Node,
) {
	if (ts.isObjectLiteralExpression(node)) {
		return node;
	}
	let result: ts.ObjectLiteralExpression | undefined;
	node.forEachChild(child => {
		if (!result) {
			result = findObjectLiteralExpression(ts, child);
		}
	});
	return result;
}

function resolveModelOption(
	ts: typeof import('typescript'),
	printer: ts.Printer,
	sourceFile: ts.SourceFile,
	options: ts.ObjectLiteralExpression,
) {
	let _default: string | undefined;

	for (const prop of options.properties) {
		if (ts.isPropertyAssignment(prop)) {
			const name = prop.name.getText(sourceFile);
			if (name === 'default') {
				const expNode = resolveDefaultOptionExpression(ts, prop.initializer);
				const expText = printer.printNode(ts.EmitHint.Expression, expNode, sourceFile) ?? expNode.getText(sourceFile);
				_default = expText;
			}
		}
	}

	return _default;
}

export function resolveDefaultOptionExpression(
	ts: typeof import('typescript'),
	_default: ts.Expression,
) {
	if (ts.isArrowFunction(_default)) {
		if (ts.isBlock(_default.body)) {
			return _default; // TODO
		}
		else if (ts.isParenthesizedExpression(_default.body)) {
			return _default.body.expression;
		}
		else {
			return _default.body;
		}
	}
	return _default;
}
