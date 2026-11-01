<script setup lang="ts" generic="T">
withDefaults(defineProps<{ foo?: number; bar?: T; baz?: () => number }>(), {
	foo: 1,
	baz: () => () => 2,
});
defineModel<number>({ default: 3 });
</script>
