<script lang="ts">
import { exactType } from 'vue-tsc/shared';
import { defineComponent, PropType } from 'vue';
import ScriptSetup from './script-setup.vue';
import ScriptSetupGeneric from './script-setup-generic.vue';

const ScriptSetupExact = defineComponent({
	props: {} as {
		a: PropType<string>;
		b: { type: PropType<string>, required: true };
		c: { type: PropType<number>, required: true };
		d: PropType<number>;
		e: PropType<string>;
		f: { type: PropType<string>, required: true };
		g: PropType<string>;
	},
	setup() {
		return {};
	},
});
declare const ScriptSetupGenericExact: <T, >(
	_props?: {
		a?: T | undefined;
		b?: T | undefined;
		c?: T | undefined;
		d: T;
	} & import('vue').VNodeProps,
	_ctx?: {
		attrs: any,
		slots: {},
		emit: any,
		expose(_exposed: {}): void,
	}
) => JSX.Element & {
	__props?: typeof _props;
	__ctx?: typeof _ctx;
};

exactType(ScriptSetup, ScriptSetupExact);
exactType(ScriptSetupGeneric, ScriptSetupGenericExact);
</script>
