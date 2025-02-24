<script setup lang="ts">
defineModel<number>();
defineModel<string[]>('foo', {
	required: true,
});
defineModel<boolean>('bar', {
	default: false,
});
defineModel<string, 'lazy' | 'trim'>('baz');
</script>
