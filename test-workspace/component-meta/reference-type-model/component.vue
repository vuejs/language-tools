<script setup lang="ts">
/**
 * required number modelValue
 */
defineModel<number>({
	required: true,
});
/**
 * optional boolean foo with default false
 */
defineModel<boolean>('foo', {
	default: false,
});
/**
 * optional string bar with lazy and trim modifiers
 */
defineModel<string, 'lazy' | 'trim'>('bar');
</script>
