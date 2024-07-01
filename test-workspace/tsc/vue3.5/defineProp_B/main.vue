<script lang="ts">
import { exactType } from '../../shared';
import { defineComponent } from 'vue';
import ScriptSetup from './script-setup.vue';
import ScriptSetupGeneric from './script-setup-generic.vue';

const ScriptSetupExact = defineComponent({
	__typeProps: {} as {
		a?: string,
		b: string,
		c: number,
		d?: number,
		e?: string,
		f: string,
		g?: string,
	},
	setup() {
		return {};
	},
});
declare const ScriptSetupGenericExact: <T, >(
	_props: NonNullable<Awaited<typeof _setup>>['props'],
	_ctx?: Pick<NonNullable<Awaited<typeof _setup>>, 'attrs' | 'emit' | 'slots'>,
	_expose?: NonNullable<Awaited<typeof _setup>>['expose'],
	_setup?: Promise<{
		props: {
			a?: T | undefined;
			b?: T | undefined;
			c?: T | undefined;
			d: T;
		} & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps,
		attrs: any,
		slots: {},
		emit: {},
		expose(_exposed: {}): void,
	}>
) => import('vue').VNode & { __ctx?: Awaited<typeof _setup>; };

exactType(ScriptSetup, ScriptSetupExact);
exactType(ScriptSetupGeneric, ScriptSetupGenericExact);
</script>
