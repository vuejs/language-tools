declare global {
	const __VLS_directiveBindingRestFields: { instance: null; oldValue: null; value: null; modifiers: any; dir: any };

	type __VLS_BuiltInDirectives = {
		vHtml: (el: HTMLElement, binding: { value: string }) => void;
		vText: (el: HTMLElement, binding: { value: string | number }) => void;
		vCloak: (el: HTMLElement) => void;
		vMemo: (el: HTMLElement, binding: { value: any[] }) => void;
	};
	type __VLS_Elements = __VLS_SpreadMerge<SVGElementTagNameMap, HTMLElementTagNameMap>;
	type __VLS_IsAny<T> = 0 extends 1 & T ? true : false;
	type __VLS_PickNotAny<A, B> = __VLS_IsAny<A> extends true ? B : A;
	type __VLS_SpreadMerge<A, B> = Omit<A, keyof B> & B;
	type __VLS_WithComponent<
		N0 extends string,
		LocalComponents,
		GlobalComponents,
		Self,
		N1 extends string,
		N2 extends string = N1,
		N3 extends string = N1,
	> = N1 extends keyof LocalComponents ? { [K in N0]: LocalComponents[N1] }
		: N2 extends keyof LocalComponents ? { [K in N0]: LocalComponents[N2] }
		: N3 extends keyof LocalComponents ? { [K in N0]: LocalComponents[N3] }
		: Self extends object ? { [K in N0]: Self }
		: N1 extends keyof GlobalComponents ? { [K in N0]: GlobalComponents[N1] }
		: N2 extends keyof GlobalComponents ? { [K in N0]: GlobalComponents[N2] }
		: N3 extends keyof GlobalComponents ? { [K in N0]: GlobalComponents[N3] }
		: {};
	type __VLS_ExtractComponentContext<T, K> = __VLS_PickNotAny<
		'__ctx' extends keyof __VLS_PickNotAny<K, {}> ? K extends { __ctx?: infer Ctx } ? NonNullable<Ctx> : never : any,
		T extends (props: any, ctx: infer Ctx) => any ? (unknown extends Ctx ? any : Ctx) : any
	>;
	type __VLS_ExtractComponentProps<T, K> = '__ctx' extends keyof __VLS_PickNotAny<K, {}>
		? K extends { __ctx?: { props?: infer P } } ? NonNullable<P> : never
		: T extends (props: infer P, ...args: any) => any ? P
		: {};
	type __VLS_FunctionalComponent<T, P = {}> = (
		props: (T extends { $props: infer Props } ? Props : {}) & P,
		ctx?: any,
	) => {
		__ctx?: {
			attrs?: any;
			slots?: T extends { $slots: infer Slots } ? Slots : Record<string, any>;
			emit?: T extends { $emit: infer Emit } ? Emit : {};
			props?: typeof props;
			expose?: (exposed: T) => void;
		};
	};
	// https://github.com/vuejs/core/blob/245230e135152900189f13a4281302de45fdcfaa/packages/shared/src/globalsAllowList.ts
	type __VLS_Globals =
		& Pick<
			typeof globalThis,
			Extract<
				| 'Infinity'
				| 'NaN'
				| 'isFinite'
				| 'isNaN'
				| 'parseFloat'
				| 'parseInt'
				| 'decodeURI'
				| 'decodeURIComponent'
				| 'encodeURI'
				| 'encodeURIComponent'
				| 'Math'
				| 'Number'
				| 'Date'
				| 'Array'
				| 'Object'
				| 'Boolean'
				| 'String'
				| 'RegExp'
				| 'Map'
				| 'Set'
				| 'JSON'
				| 'Intl'
				| 'BigInt'
				| 'console'
				| 'Error'
				| 'Symbol',
				keyof typeof globalThis
			>
		>
		& { undefined: undefined };
	type __VLS_IsFunction<T, K> = K extends keyof T ? unknown extends T[K] ? false
		: true
		: false;
	// what `v-model` writes back from the prop it binds; `any` for a prop the component does not declare,
	// which the props check reports instead
	type __VLS_ModelWriteBack<Props, K extends PropertyKey> = K extends keyof Props ? Props[K] & {} : any;
	// The checker links the properties of a mapped type to declarations only when it maps a `keyof` without renaming
	// the keys (not `Remapping`); `Pick` does, so a declared event prop stays the listener's symbol and references and
	// definitions reach it, while the listeners of emits are new symbols
	type __VLS_ResolveEvent<
		Props,
		Emits,
		onEvent extends string,
		Event extends string,
		CamelizedEvent extends string,
	> = __VLS_IsFunction<Props, onEvent> extends true ? Pick<Props, onEvent & keyof Props>
		: __VLS_IsFunction<Emits, Event> extends true ? { [K in onEvent]?: Emits[Event & keyof Emits] }
		: __VLS_IsFunction<Emits, CamelizedEvent> extends true ? { [K in onEvent]?: Emits[CamelizedEvent & keyof Emits] }
		: Props;
	// the rest parameter `$event` of an inline handler is destructured from, as if it were contextually typed by `T[K]`:
	// the parameters of the handler (`[undefined?]` for none), or `any[]` without one handler signature
	// (no such property, or overloads or union members of different parameters);
	// the parameters of each signature are wrapped, so a union of tuples in one signature stays one signature
	type __VLS_EventArgs<T, K extends PropertyKey> = K extends keyof T
		? __VLS_IsAny<T[K]> extends true ? any[] : __VLS_HandlerArgs<__VLS_HandlerParameters<NonNullable<T[K]>>>
		: any[];
	type __VLS_HandlerParameters<F> = F extends unknown
		? __VLS_OverloadUnion<F> extends infer S ? S extends (...args: infer P) => any ? [P] : never : never
		: never;
	type __VLS_HandlerArgs<W> = [W] extends [never] ? any[]
		: [W] extends [__VLS_UnionToIntersection<W>] ? W extends [infer P] ? P extends [] ? [undefined?] : P : never
		: any[];
	// fix https://github.com/vuejs/language-tools/issues/926
	type __VLS_UnionToIntersection<U> = (U extends unknown ? (arg: U) => unknown : never) extends
		((arg: infer P) => unknown) ? P : never;
	type __VLS_OverloadUnionInner<T, U = unknown> = U & T extends (...args: infer A) => infer R ? U extends T ? never
		: __VLS_OverloadUnionInner<T, Pick<T, keyof T> & U & ((...args: A) => R)> | ((...args: A) => R)
		: never;
	type __VLS_OverloadUnion<T> = Exclude<
		__VLS_OverloadUnionInner<(() => never) & T>,
		T extends () => never ? never : () => never
	>;
	type __VLS_ConstructorOverloads<T> = __VLS_OverloadUnion<T> extends infer F
		? F extends (event: infer E, ...args: infer A) => any ? { [K in E & string]: (...args: A) => void }
		: never
		: never;
	type __VLS_NormalizeEmits<T> = __VLS_PrettifyGlobal<
		__VLS_UnionToIntersection<
			& __VLS_ConstructorOverloads<T>
			& {
				[K in keyof T]: T[K] extends any[] ? { (...args: T[K]): void } : never;
			}
		>
	>;
	type __VLS_EmitsToProps<T> = __VLS_PrettifyGlobal<
		{
			[K in string & keyof T as `on${Capitalize<K>}`]?: (
				...args: T[K] extends (...args: infer P) => any ? P : T[K] extends null ? any[] : never
			) => any;
		}
	>;
	type __VLS_ShortEmits<E extends Record<string, any[]>> = __VLS_UnionToIntersection<
		{ [K in keyof E]: (event: K, ...args: E[K]) => void }[keyof E]
	>;
	type __VLS_ShortEmitsToObject<E> = E extends Record<string, any[]> ? { [K in keyof E]: (...args: E[K]) => any }
		: E;
	type __VLS_ResolveEmits<
		Comp,
		Emits,
		TypeEmits = Comp extends { __typeEmits?: infer T } ? unknown extends T ? {} : __VLS_ShortEmitsToObject<T> : {},
		NormalizedEmits = __VLS_NormalizeEmits<Emits> extends infer E ? string extends keyof E ? {} : E : never,
	> = __VLS_SpreadMerge<NormalizedEmits, TypeEmits>;
	// the entries of `T` by the names of `Searched`, each the entry of the first key in its list that `T` has
	type __VLS_ResolveAssets<T, Searched extends Record<string, string[]>> = {
		[N in keyof Searched as [__VLS_FirstKey<T, Searched[N]>] extends [never] ? never : N]: T[
			__VLS_FirstKey<T, Searched[N]> & keyof T
		];
	};
	type __VLS_FirstKey<T, Keys> = Keys extends [infer K, ...infer Rest] ? K extends keyof T ? K : __VLS_FirstKey<T, Rest>
		: never;
	type __VLS_PrettifyGlobal<T> = (T extends any ? { [K in keyof T]: T[K] } : { [K in keyof T as K]: T[K] }) & {};

	// hooks are called with their own arity; those taking fewer than (el, binding) are padded so the binding can be passed
	type __VLS_DirectiveHook<F> = F extends (...args: infer A) => infer R
		? A['length'] extends 0 | 1 ? (el: A[0], binding: unknown) => R : OmitThisParameter<F>
		: F;
	type __VLS_DirectiveHookArgsRest<F> = F extends (...args: [any, any, ...infer Rest]) => any
		? { [K in keyof Rest]: never }
		: [];

	function __VLS_vFor<const T>(source: T): T extends number ? [number, number][]
		: T extends string ? [string, number][]
		: T extends readonly any[] ? (T extends readonly (infer U)[] ? [U, number] : never)[]
		: T extends Iterable<any> ? (T extends Iterable<infer V> ? [V, number] : never)[]
		: [T[keyof T], keyof T extends string ? keyof T : `${keyof T & (string | number)}`, number][];
	function __VLS_vSlot<S, D extends S>(slot: S, decl?: D): D extends (...args: infer P) => any ? P : any[];
	function __VLS_nonNull<T>(value: T): NonNullable<T>;
	function __VLS_asFunctionalDirective<T, ObjectDirective>(
		dir: T,
		od: ObjectDirective,
	): __VLS_DirectiveHook<
		T extends ObjectDirective ? NonNullable<
				T[
					keyof T & ('created' | 'beforeMount' | 'mounted' | 'beforeUpdate' | 'updated' | 'beforeUnmount' | 'unmounted')
				]
			>
			: T extends (...args: any) => any ? T
			: (arg1: unknown, arg2: unknown, arg3: unknown, arg4: unknown) => void
	>;
	// the longest rest among a union of hooks
	function __VLS_directiveHookArgsRest<F>(
		hook: F,
	): [never, never] extends __VLS_DirectiveHookArgsRest<F> ? [never, never]
		: [never] extends __VLS_DirectiveHookArgsRest<F> ? [never]
		: [];
	function __VLS_asFunctionalComponent0<T, K>(
		t: T,
		instance: K,
	): T extends new(...args: any) => any ? __VLS_FunctionalComponent<K>
		: T extends () => any ? (props: {}, ctx?: any) => ReturnType<T>
		: T extends (...args: any) => any ? T
		: __VLS_FunctionalComponent<{}>;
	type __VLS_PadArgs<A extends any[]> = A extends [any, ...infer Rest] ? [any, ...__VLS_PadArgs<Rest>] : [];
	function __VLS_functionalComponentArgsRest<T extends (...args: any) => any>(
		t: T,
	): __VLS_PadArgs<Parameters<T> extends [any, ...infer Rest] ? Rest : []>;
	function __VLS_asFunctionalElement0<T>(tag: T, endTag?: T): (attrs: T) => void;
	function __VLS_asFunctionalSlot<S>(
		slot: S,
	): S extends (...args: any) => any ? (S extends () => infer R ? (props: {}) => R : S)
		: (S extends null | undefined ? never : (props: S) => any);
	function __VLS_omit<T, K>(target: T, props: K): Omit<T, keyof K>;
	function __VLS_tryAsConstant<const T>(t: T): T;
	// Keep a stable `.value` chain for narrowing. A real ref retains its type
	// (including readonly values); a plain value gets a separate wrapper rather
	// than an intersection with `Ref`, which would erase nullish values.
	function __VLS_withDotValue<const T, Ref>(
		t: T,
		ref: Ref,
	): [T] extends [Ref] ? T
		: Ref & { value: T extends Ref & { value: infer V } ? V : T };
	// `const` keeps literal bindings (`const n = 1`) from widening: since TS 7.1
	// the false-branch `T` is the distributed type parameter, which no longer
	// counts as `T` appearing at the top level of the return type.
	function __VLS_unwrap<const T, Ref>(t: T, ref: Ref): T extends Ref & { value: infer V } ? V
		: T;
}

export {};
