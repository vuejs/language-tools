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

defineModel<number>('corge', {
	// @ts-expect-error the return type is checked since vuejs/core#14968
	default: (props) => props.foo,
});

exactType(bar.value, {} as string);
exactType(baz.value, {} as string);
exactType(qux.value, {} as string);
</script>
