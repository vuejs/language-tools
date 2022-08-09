import * as CompilerDom from '@vue/compiler-dom';
import * as CompilerCore from '@vue/compiler-core';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerVue2 from './vue2TemplateCompiler';

export function compileSFCTemplate(htmlCode: string, options: CompilerDOM.CompilerOptions = {}, vueVersion: number) {

	const errors: CompilerDOM.CompilerError[] = [];
	const warnings: CompilerDOM.CompilerError[] = [];
	let ast: CompilerDOM.RootNode | undefined;

	try {
		ast = (vueVersion < 3 ? CompilerVue2 : CompilerDOM).compile(htmlCode, {
			onError: (err: CompilerDOM.CompilerError) => errors.push(err),
			onWarn: (err: CompilerDOM.CompilerError) => warnings.push(err),
			expressionPlugins: ['typescript'],
			...options,
		}).ast;
	}
	catch (e) {
		const err = e as CompilerDOM.CompilerError;
		errors.push(err);
	}

	return {
		errors,
		warnings,
		ast,
	};
}

export function compile(
	template: string,
	options: CompilerDom.CompilerOptions = {}
): CompilerDom.CodegenResult {

	const onError = options.onError;
	options.onError = (error) => {
		if (
			error.code === CompilerCore.ErrorCodes.X_V_FOR_TEMPLATE_KEY_PLACEMENT // :key binding allowed in v-for template child in vue 2
			|| error.code === CompilerCore.ErrorCodes.X_V_IF_SAME_KEY // fix https://github.com/johnsoncodehk/volar/issues/1638
		) {
			return;
		}
		if (onError) {
			onError(error);
		}
		else {
			throw error;
		}
	};

	return baseCompile(
		template,
		Object.assign({}, CompilerDom.parserOptions, options, {
			nodeTransforms: [
				...CompilerDom.DOMNodeTransforms,
				...(options.nodeTransforms || [])
			],
			directiveTransforms: Object.assign(
				{},
				CompilerDom.DOMDirectiveTransforms,
				options.directiveTransforms || {}
			),
		})
	);
}

export function baseCompile(
	template: string,
	options: CompilerCore.CompilerOptions = {}
): CompilerCore.CodegenResult {

	const onError = options.onError || ((error) => { throw error; });
	const isModuleMode = options.mode === 'module';

	const prefixIdentifiers = options.prefixIdentifiers === true || isModuleMode;
	if (!prefixIdentifiers && options.cacheHandlers) {
		onError(CompilerCore.createCompilerError(CompilerCore.ErrorCodes.X_CACHE_HANDLER_NOT_SUPPORTED));
	}
	if (options.scopeId && !isModuleMode) {
		onError(CompilerCore.createCompilerError(CompilerCore.ErrorCodes.X_SCOPE_ID_NOT_SUPPORTED));
	}

	const ast = CompilerCore.baseParse(template, options);
	const [nodeTransforms, directiveTransforms] = CompilerCore.getBaseTransformPreset(prefixIdentifiers);

	// v-for > v-if in vue 2
	const transformIf = nodeTransforms[1];
	const transformFor = nodeTransforms[3];
	nodeTransforms[1] = transformFor;
	nodeTransforms[3] = transformIf;

	CompilerCore.transform(
		ast,
		Object.assign({}, options, {
			prefixIdentifiers,
			nodeTransforms: [
				...nodeTransforms,
				...(options.nodeTransforms || []) // user transforms
			],
			directiveTransforms: Object.assign(
				{},
				directiveTransforms,
				options.directiveTransforms || {} // user transforms
			)
		})
	);

	return CompilerCore.generate(
		ast,
		Object.assign({}, options, {
			prefixIdentifiers
		})
	);
}
