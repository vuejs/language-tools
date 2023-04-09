export type ComponentProps<T> =
	T extends (props: infer P) => any ? P :
	T extends new () => { $props: infer P } ? P :
	{};

export type ComponentSlots<T> =
	T extends (props: any, ctx: { slots: infer S }) => any ? S :
	T extends new () => { $slots: infer S } ? S :
	{};

export type ComponentEmit<T> =
	T extends (props: any, ctx: { emit: infer E }) => any ? E :
	T extends new () => { $emit: infer E } ? E :
	{};

export type ComponentExposed<T> =
	T extends (props: any, ctx: { expose(exposed?: infer E): any }) => any ? E :
	T extends new () => infer E ? E :
	{};

/**
 * Vue 2.x
 */

export type Vue2ComponentSlots<T> =
	T extends (props: any, ctx: { slots: infer S }) => any ? S :
	T extends new () => { $scopedSlots: infer S } ? S :
	{};
