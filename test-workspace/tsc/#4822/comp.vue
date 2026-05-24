<script setup lang="ts" generic="T">
defineModel<T>();
defineEmits<{
	(event: 'foo', arg: T): any;
}>();
</script>
