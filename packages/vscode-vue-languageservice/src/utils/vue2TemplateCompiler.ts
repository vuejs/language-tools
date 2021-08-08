import * as CompilerCore from '@vue/compiler-core';

export function vue2Compile(
	template: string,
	options: CompilerCore.CompilerOptions = {}
): CompilerCore.CodegenResult {

	// force to vue 2
	options.compatConfig = { MODE: 2 }

	const onError = ((error: CompilerCore.CompilerError) => {
		if (error.code === CompilerCore.ErrorCodes.X_V_FOR_TEMPLATE_KEY_PLACEMENT)
			return // :key binding allow in v-for template child in vue 2
		if (options.onError)
			options.onError(error)
		else
			throw error
	})
	const isModuleMode = options.mode === 'module'

	const prefixIdentifiers = options.prefixIdentifiers === true || isModuleMode
	if (!prefixIdentifiers && options.cacheHandlers) {
		onError(CompilerCore.createCompilerError(CompilerCore.ErrorCodes.X_CACHE_HANDLER_NOT_SUPPORTED))
	}
	if (options.scopeId && !isModuleMode) {
		onError(CompilerCore.createCompilerError(CompilerCore.ErrorCodes.X_SCOPE_ID_NOT_SUPPORTED))
	}

	const ast = CompilerCore.baseParse(template, options)
	const [nodeTransforms, directiveTransforms] = CompilerCore.getBaseTransformPreset(prefixIdentifiers)

	// v-for > v-if in vue 2
	const transformIf = nodeTransforms[1]
	const transformFor = nodeTransforms[3]
	nodeTransforms[1] = transformFor
	nodeTransforms[3] = transformIf

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
	)

	return CompilerCore.generate(
		ast,
		Object.assign({}, options, {
			prefixIdentifiers
		})
	)
}
