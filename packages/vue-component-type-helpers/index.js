exports.default = `
type ComponentProps<T> =
	T extends new () => { $props: infer P } ? NonNullable<P> :
	T extends (props: infer P, ...args: any) => any ? P :
	{};

type ComponentSlots<T> =
	T extends new () => { $slots: infer S } ? NonNullable<S> :
	T extends (props: any, ctx: { slots: infer S }, ...args: any) => any ? NonNullable<S> :
	{};

type ComponentEmit<T> =
	T extends new () => { $emit: infer E } ? NonNullable<E> :
	T extends (props: any, ctx: { emit: infer E }, ...args: any) => any ? NonNullable<E> :
	{};

type ComponentExposed<T> =
	T extends new () => infer E ? E :
	T extends (props: any, ctx: { expose(exposed: infer E): any }, ...args: any) => any ? NonNullable<E> :
	{};

/**
* Vue 2.x
*/

type Vue2ComponentSlots<T> =
	T extends new () => { $scopedSlots: infer S } ? NonNullable<S> :
	T extends (props: any, ctx: { slots: infer S }, ...args: any) => any ? NonNullable<S> :
	{};
`.trim();
