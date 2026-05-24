<script setup lang="ts" generic="T">
export type Emits = {
  change: [id: number];
  update: [value: string];
};

defineEmits<Emits>();
</script>