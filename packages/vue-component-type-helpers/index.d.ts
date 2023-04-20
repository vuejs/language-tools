export type ComponentProps<T> =
	T extends (props: infer P, ...args: any) => any ? P :
	T extends new () => { $props: infer P } ? NonNullable<P> :
	{};

export type ComponentSlots<T> =
	T extends (props: any, ctx: { slots: infer S }, ...args: any) => any ? NonNullable<S> :
	T extends new () => { $slots: infer S } ? NonNullable<S> :
	{};

export type ComponentEmit<T> =
	T extends (props: any, ctx: { emit: infer E }, ...args: any) => any ? NonNullable<E> :
	T extends new () => { $emit: infer E } ? NonNullable<E> :
	{};

export type ComponentExposed<T> =
	T extends (props: any, ctx: { expose(exposed: infer E): any }, ...args: any) => any ? NonNullable<E> :
	T extends new () => infer E ? E :
	{};

/**
 * Vue 2.x
 */

export type Vue2ComponentSlots<T> =
	T extends (props: any, ctx: { slots: infer S }, ...args: any) => any ? NonNullable<S> :
	T extends new () => { $scopedSlots: infer S } ? NonNullable<S> :
	{};
