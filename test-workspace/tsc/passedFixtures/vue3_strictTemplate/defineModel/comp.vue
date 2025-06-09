<script setup lang="ts">
defineModel<number>('foo');
defineModel<number>('bar', { required: true });
</script>
