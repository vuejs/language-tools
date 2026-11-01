<script lang="ts">
declare function useFoo<T = unknown>(): { value: T };
const before: number = useFoo().value;
export default {
	setup() {
		const inside: number = useFoo().value;
		return { before, inside };
	},
};
const after: number = useFoo().value;
</script>
