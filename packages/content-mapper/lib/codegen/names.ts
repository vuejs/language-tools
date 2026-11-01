const raw = {
	base: '',
	export: '',
	components: '',
	componentsOption: '',
	ctx: '',
	directives: '',
	directivesOption: '',
	dollars: '',
	exposed: '',
	intrinsics: '',
	propsOption: '',
	scope: '',
	self: '',
	setup: '',
	src: '',
	template: '',

	EmitProps: '',
	GlobalComponents: '',
	LocalComponents: '',
	LocalDirectives: '',
	BuiltInDirectives: '',
	PluginEmits: '',
	PluginProps: '',
	PublicProps: '',
	Scope: '',
	StyleScopedClasses: '',

	// #region template helpers
	asFunctionalComponent0: '',
	asFunctionalDirective: '',
	asFunctionalElement0: '',
	asFunctionalSlot: '',
	directiveBindingRestFields: '',
	directiveHookArgsRest: '',
	functionalComponentArgsRest: '',
	nonNull: '',
	omit: '',
	tryAsConstant: '',
	unwrap: '',
	vFor: '',
	vSlot: '',
	withDotValue: '',

	ConstructorOverloads: '',
	Elements: '',
	EmitsToProps: '',
	EventArgs: '',
	ExtractComponentContext: '',
	ExtractComponentProps: '',
	FirstKey: '',
	FunctionalComponent: '',
	Globals: '',
	HandlerArgs: '',
	HandlerParameters: '',
	IsAny: '',
	IsFunction: '',
	ModelWriteBack: '',
	NormalizeEmits: '',
	OverloadUnion: '',
	OverloadUnionInner: '',
	PickNotAny: '',
	PrettifyGlobal: '',
	ResolveAssets: '',
	ResolveEmits: '',
	ResolveEvent: '',
	ShortEmits: '',
	ShortEmitsToObject: '',
	SpreadMerge: '',
	UnionToIntersection: '',
	WithComponent: '',
	// #endregion
};

export const names = Object.fromEntries(
	Object.keys(raw).map(key => [key, `__VLS_${key}`]),
) as typeof raw;

/**
 * The names of the identifiers that the codegen plugins of a file declare, for each plugin: `__VLS_<hint>`, or that
 * with `$<n>` when the generated code or a plugin before took it. The same hint of a plugin is the same name.
 */
export function createPluginNames(): (plugin: string) => (hint: string) => string {
	const taken = new Set<string>(Object.values(names));
	return plugin => {
		const own = new Map<string, string>();
		return hint => {
			if (typeof hint !== 'string' || !/^[A-Za-z_]\w*$/.test(hint)) {
				throw new TypeError(
					`The codegen plugin '${plugin}' named ${JSON.stringify(hint)}, which is not an identifier without '$'.`,
				);
			}
			let name = own.get(hint);
			if (name === undefined) {
				name = `__VLS_${hint}`;
				for (let n = 1; taken.has(name); n++) {
					name = `__VLS_${hint}$${n}`;
				}
				taken.add(name);
				own.set(hint, name);
			}
			return name;
		};
	};
}
