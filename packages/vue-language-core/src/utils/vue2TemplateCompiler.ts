import * as CompilerDom from '@vue/compiler-dom';

export * from '@vue/compiler-dom';

export function compile(
	template: string,
	options: CompilerDom.CompilerOptions = {}
): CompilerDom.CodegenResult {

	const onError = options.onError;
	options.onError = (error) => {
		if (
			error.code === CompilerDom.ErrorCodes.X_V_FOR_TEMPLATE_KEY_PLACEMENT // :key binding allowed in v-for template child in vue 2
			|| error.code === CompilerDom.ErrorCodes.X_V_IF_SAME_KEY // fix https://github.com/johnsoncodehk/volar/issues/1638
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
