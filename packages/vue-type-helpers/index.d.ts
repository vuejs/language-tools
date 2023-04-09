export type ComponentProps<T> = FunctionalComponentProps<FunctionalComponent<T>>;

export type ComponentSlots<T> = FunctionalComponentSlots<FunctionalComponent<T>>;

export type ComponentEmit<T> = FunctionalComponentEmit<FunctionalComponent<T>>;

export type ComponentExposed<T> = FunctionalComponentExposed<FunctionalComponent<T>>;

export type FunctionalComponentProps<T> = T extends (props: infer Props, ...args: any) => any ? Props : never;

export type FunctionalComponentSlots<T> = T extends (props: any, ctx: { slots: infer Slots; }, ...args: any) => any ? NonNullable<Slots> : never;

export type FunctionalComponentEmit<T> = T extends (props: any, ctx: { emit: infer Emit; }, ...args: any) => any ? NonNullable<Emit> : never;

export type FunctionalComponentExposed<T> = T extends (props: any, ctx: { expose(exposed: infer Exposed): void; }, ...args: any) => any ? Exposed : never;

export type FunctionalComponent<T, K = T extends new (...args: any) => any ? InstanceType<T> : unknown> =
	T extends (...args: any) => any ? T
	: K extends { $props: infer Props, $slots: infer Slots, $emit: infer Emit; }
	? (props: Props, ctx?: { attrs?: any, expose?(exposed: K): void, slots?: Slots, emit?: Emit; }) => { __ctx?: typeof ctx, __props?: typeof props; }
	: never;
