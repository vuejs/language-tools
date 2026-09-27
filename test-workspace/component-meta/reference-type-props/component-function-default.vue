<script setup lang="ts">
defineProps({
	object: {
		type: Object,
		default() {
			return { message: 'foo' };
		},
	},
	func: {
		type: Function,
		default: (value: number) => value * 2,
	},
	funcMethod: {
		type: Function,
		default() {
			return 'Default function';
		},
	},
	funcOrString: {
		type: [Function, String],
		default: () => 'foo',
	},
	commented: {
		type: Function,
		// default: returns one
		default() {
			return 1;
		},
	},
	generator: {
		type: Function,
		*default() {
			yield 1;
		},
	},
	asyncFactory: {
		type: Object,
		async default() {
			return {};
		},
	},
});
</script>
