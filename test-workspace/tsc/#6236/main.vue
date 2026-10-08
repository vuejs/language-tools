<script lang="ts" setup>
import { exactType } from '../shared';

defineProps<{
	foo: string;
}>();

const bar = defineModel<string>('bar', {
	default: (props) => {
		exactType(props.foo, {} as string);
		return props.foo;
	},
});

const baz = defineModel<string>('baz', {
	default: props => props.foo,
});

const qux = defineModel('qux', {
	type: String,
	default: props => {
		exactType(props.foo, {} as string);
		return props.foo;
	},
});

defineModel('quux', {
	default: props => {
		exactType(props.foo, {} as string);
		return props.foo;
	},
});

const grault = defineModel<string>('grault', {
	default(props) {
		exactType(props.foo, {} as string);
		return props.foo;
	},
});

defineModel('garply', {
	async default(props) {
		exactType(props.foo, {} as string);
	},
});

defineModel<number>('corge', {
	// @ts-expect-error the return type is checked since vuejs/core#14968
	default: (props) => props.foo,
});

const waldo = defineModel<string>('waldo', {
	default: 'waldo',
});

const fred = defineModel<() => void>('fred', {
	default: () => {},
});

exactType(bar.value, {} as string);
exactType(baz.value, {} as string);
exactType(qux.value, {} as string);
exactType(grault.value, {} as string);
exactType(waldo.value, {} as string);
exactType(fred.value, {} as () => void);
</script>
