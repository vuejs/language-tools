import { h, defineComponent } from 'vue';

export default defineComponent(() => {
	defineComponentMeta({ foo: 'bar', nested: { foo: 'baz', arr: [1, 2] } })
	return () => h('span');
});
