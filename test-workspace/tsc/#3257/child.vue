<script setup lang="ts" generic>
export type Emits = {
  change: [id: number];
  update: [value: string];
};

defineEmits<Emits>();
</script>