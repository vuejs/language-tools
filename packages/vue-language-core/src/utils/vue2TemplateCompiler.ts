import * as CompilerDom from '@vue/compiler-dom';

const Vue2TemplateCompiler: typeof import('vue-template-compiler') = require('vue-template-compiler/build');

export * from '@vue/compiler-dom';

export function compile(
	template: string,
	options: CompilerDom.CompilerOptions = {}
): CompilerDom.CodegenResult {

	const onError = options.onError;
	const onWarn = options.onWarn;

	options.onError = (error) => {
		// ignore all error for baseCompile
		return;
	};
	options.onWarn = (error) => {
		// ignore all error for baseCompile
		return;
	};

	const vue2Result = Vue2TemplateCompiler.compile(template, { outputSourceRange: true });

	for (const error of vue2Result.errors) {
		onError?.({
			code: '',
			name: '',
			message: error.msg,
			loc: {
				source: '',
				start: { column: -1, line: -1, offset: error.start },
				end: { column: -1, line: -1, offset: error.end ?? error.start },
			},
		});
	}
	for (const error of vue2Result.tips) {
		onWarn?.({
			code: '',
			name: '',
			message: error.msg,
			loc: {
				source: '',
				start: { column: -1, line: -1, offset: error.start },
				end: { column: -1, line: -1, offset: error.end ?? error.start },
			},
		});
	}

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

function baseCompile(
	template: string,
	options: CompilerDom.CompilerOptions = {}
): CompilerDom.CodegenResult {

	const onError = options.onError || ((error) => { throw error; });
	const isModuleMode = options.mode === 'module';

	const prefixIdentifiers = options.prefixIdentifiers === true || isModuleMode;
	if (!prefixIdentifiers && options.cacheHandlers) {
		onError(CompilerDom.createCompilerError(CompilerDom.ErrorCodes.X_CACHE_HANDLER_NOT_SUPPORTED));
	}
	if (options.scopeId && !isModuleMode) {
		onError(CompilerDom.createCompilerError(CompilerDom.ErrorCodes.X_SCOPE_ID_NOT_SUPPORTED));
	}

	const ast = CompilerDom.baseParse(template, options);
	const [nodeTransforms, directiveTransforms] = CompilerDom.getBaseTransformPreset(prefixIdentifiers);

	// v-for > v-if in vue 2
	const transformIf = nodeTransforms[1];
	const transformFor = nodeTransforms[3];
	nodeTransforms[1] = transformFor;
	nodeTransforms[3] = transformIf;

	CompilerDom.transform(
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

	return CompilerDom.generate(
		ast,
		Object.assign({}, options, {
			prefixIdentifiers
		})
	);
}
