import * as CompilerDOM from '@vue/compiler-dom';
import {
	getModelPropName,
	isCompoundExpression,
	navigationFeatures,
	scriptFeatures,
	semanticFeatures,
	type TypeScript,
	type VueCodeMarker,
} from '@vue/language-core';
import { getTypeScriptAST } from '@vue/language-core/lib/typescript/typescriptAST';
import { camelize, capitalize } from '@vue/shared';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import { names } from '../names';
import { Boundary, synthesizedIgnore, type TsCode } from '../tsCode';
import { endOfLine, generateTypedVar, getRefBrandArgument, identifierRE, isTsLang, newLine } from '../writers';
import { generateCamelized } from '../writers/camelized';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generateElementEvents(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	componentOriginalVar: string,
	getCtxVar: () => string,
	getPropsVar: () => string,
): Generator<TsCode> {
	const definitions: Record<string, {
		propPrefix: string;
		emitPrefix: string;
		propName: string;
		emitName: string;
		items: {
			prop: CompilerDOM.DirectiveNode;
			source: string;
			offset: number | undefined;
		}[];
	}> = {};
	const writeBacks: { prop: CompilerDOM.DirectiveNode; propName: string }[] = [];

	for (const prop of node.props) {
		if (prop.type === CompilerDOM.NodeTypes.DIRECTIVE && prop.name === 'model' && !prop.arg) {
			const propName = getModelPropName(node, options.vueCompilerOptions);
			// a tag mapped to another prop, like a custom element, has `v-model` write back from that prop
			// as the runtime directives of native elements do, not from an `update:modelValue` event
			if (propName !== undefined && propName !== 'modelValue') {
				writeBacks.push({ prop, propName });
				continue;
			}
		}
		if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& (
				prop.name === 'on'
					&& (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)
				|| prop.name === 'model'
					&& (!prop.arg || prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)
			)
		) {
			let source = prop.arg?.loc.source ?? 'model-value';
			let offset = prop.arg?.loc.start.offset;
			let propPrefix = 'on-';
			let emitPrefix = '';
			if (prop.name === 'model') {
				propPrefix = 'onUpdate:';
				emitPrefix = 'update:';
			}
			else if (source.startsWith('vue:')) {
				source = source.slice('vue:'.length);
				offset = offset! + 'vue:'.length;
				propPrefix = 'onVnode-';
				emitPrefix = 'vnode-';
			}
			const propName = camelize(propPrefix + source);
			const emitName = emitPrefix + source;
			const key = [
				prop.name,
				propName,
				...prop.modifiers.map(modifier => modifier.content),
			].join('+');

			definitions[key] ??= {
				propPrefix,
				emitPrefix,
				propName,
				emitName,
				items: [],
			};
			definitions[key].items.push({
				prop,
				source,
				offset,
			});
		}
	}

	for (const { prop, propName } of writeBacks) {
		const writeBackVar = ctx.getInternalVariable();
		yield `const ${writeBackVar} = `;
		yield* generateModelEventExpression(
			options,
			ctx,
			prop,
			`[${names.ModelWriteBack}<typeof ${getPropsVar()}, '${propName}'>]`,
		);
		yield endOfLine;
		yield `void ${writeBackVar}${endOfLine}`;
	}

	if (!Object.keys(definitions).length) {
		return;
	}

	const emitsVar = ctx.getInternalVariable();
	yield* generateTypedVar('let', emitsVar, options.scriptLang, function*() {
		yield `${names.ResolveEmits}<typeof ${componentOriginalVar}, typeof ${getCtxVar()}.emit>`;
	});

	for (const { propPrefix, emitPrefix, propName, emitName, items } of Object.values(definitions)) {
		const eventVar = ctx.getInternalVariable();
		const eventType =
			`Partial<${names.ResolveEvent}<typeof ${getPropsVar()}, typeof ${emitsVar}, '${propName}', '${emitName}', '${
				camelize(emitName)
			}'>>`;
		if (isTsLang(options.scriptLang)) {
			yield `const ${eventVar}: ${eventType} = {${newLine}`;
		}
		else {
			yield `/** @type {${eventType}} */${newLine}const ${eventVar} = {${newLine}`;
		}
		for (const { prop, source, offset } of items) {
			const argsType = `${names.EventArgs}<${eventType}, '${propName}'>`;
			if (prop.name === 'on') {
				yield `/** @type {typeof ${emitsVar}.`;
				const ignore = yield* Boundary.start(source, 0, 0, synthesizedIgnore);
				yield* generateEventArg(
					source,
					offset!,
					emitPrefix.slice(0, -1),
					{ features: navigationFeatures },
				);
				yield ignore.end();
				yield `} */${newLine}`;
				// in JS, the JSDoc above types the property, and fails to parse for a non-identifier name
				const emitArgName = getEventArgName(source, emitPrefix.slice(0, -1));
				yield* generateEventArg(source, offset!, propPrefix.slice(0, -1));
				yield `: `;
				yield* generateEventExpression(
					options,
					ctx,
					prop,
					isTsLang(options.scriptLang)
						? argsType
						: identifierRE.test(emitArgName)
						? `${names.EventArgs}<typeof ${emitsVar}, '${emitArgName}'>`
						: `any[]`,
				);
			}
			else {
				yield `'${propName}': `;
				yield* generateModelEventExpression(options, ctx, prop, argsType);
			}
			yield `,${newLine}`;
		}
		yield `}${endOfLine}`;
		yield `void ${eventVar}${endOfLine}`;
	}
}

export function* generateEventArg(
	name: string,
	start: number,
	directive = 'on',
	features?: VueCodeMarker,
): Generator<TsCode> {
	features ??= { features: semanticFeatures | navigationFeatures };

	if (directive.length) {
		name = capitalize(name);
	}
	const boundary = yield* Boundary.start('template', start, start + name.length, features);
	if (identifierRE.test(camelize(name))) {
		yield directive;
		yield* generateCamelized(name, 'template', start);
		yield boundary.end();
	}
	else {
		yield `'`;
		yield directive;
		yield* generateCamelized(name, 'template', start);
		yield `'`;
		yield boundary.end();
	}
}

export function getEventArgName(name: string, directive = 'on') {
	if (directive.length) {
		name = capitalize(name);
	}
	return directive + name.split('-').map((part, i) => i ? capitalize(part) : part).join('');
}

function* generateEventParameter(
	options: TemplateCodegenOptions,
	argsType: string,
): Generator<TsCode> {
	if (isTsLang(options.scriptLang)) {
		yield `(...[$event]: ${argsType}) => {${newLine}`;
	}
	else {
		yield `(/** @type {${argsType}} */ ...[$event]) => {${newLine}`;
	}
}

export function* generateEventExpression(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
	argsType: string,
): Generator<TsCode> {
	if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const ast = getTypeScriptAST(options.typescript, options.template, prop.exp.content);
		const isCompound = isCompoundExpression(options.typescript, ast);
		const interpolation = generateInterpolation(
			options,
			ctx,
			options.template,
			{ features: scriptFeatures },
			prop.exp.content,
			prop.exp.loc.start.offset,
			isCompound ? `` : `(`,
			isCompound ? `` : `)`,
		);

		if (isCompound) {
			ctx.enterBlockScope(prop);

			const accessMark = ctx.accessLog.length;
			const codes: TsCode[] = [];
			for (const code of interpolation) {
				codes.push(code);
			}

			yield* generateEventParameter(options, argsType);
			// consume $event to avoid TS6133 when the expression doesn't use it
			yield `void $event${endOfLine}`;

			yield* generateReasserts(options, ctx, accessMark);
			yield* ctx.generateConditionGuards();
			yield* ctx.exitBlockScope();

			if (isSingleExpression(options.typescript, ast)) {
				yield `return (`;
				yield* codes;
				yield `)`;
			}
			else {
				yield* codes;
			}
			yield endOfLine;
			yield `}`;
		}
		else {
			yield* interpolation;
		}
	}
	else {
		yield `() => {}`;
	}
}

export function* generateModelEventExpression(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
	argsType: string,
): Generator<TsCode> {
	if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const accessMark = ctx.accessLog.length;
		const codes = [...generateInterpolation(
			options,
			ctx,
			options.template,
			{ features: 0 },
			prop.exp.content,
			prop.exp.loc.start.offset,
		)];
		yield* generateEventParameter(options, argsType);
		yield* generateReasserts(options, ctx, accessMark);
		yield* ctx.generateConditionGuards();
		yield* codes;
		yield ` = $event${endOfLine}`;
		yield `}`;
	}
	else {
		yield `() => {}`;
	}
}

// Assertion narrowing does not flow into nested closures for imports and
// `let`/`var` bindings (TS limitation), so re-assert those bindings at closure tops.
function* generateReasserts(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	accessMark: number,
): Generator<TsCode> {
	const reasserts = new Set<string>();
	const collect = (name: string) => {
		if (options.reassertBindings.has(name) && !ctx.isDeclared(name)) {
			reasserts.add(name);
		}
	};
	for (const name of ctx.accessLog.slice(accessMark)) {
		collect(name);
	}
	for (const condition of ctx.conditions) {
		for (const name of condition.accesses) {
			collect(name);
		}
	}
	for (const name of reasserts) {
		yield `${names.withDotValue}(${name}, ${
			getRefBrandArgument(options.vueCompilerOptions, options.scriptLang)
		})${endOfLine}`;
	}
}

function isSingleExpression(ts: TypeScript, ast: ts.SourceFile) {
	if (ast.statements.length === 1 && ast.text[ast.endOfFileToken.pos - 1] !== ';') {
		const statement = ast.statements[0]!;
		if (ts.isExpressionStatement(statement)) {
			return true;
		}
	}
	return false;
}
