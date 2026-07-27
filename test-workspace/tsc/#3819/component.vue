<script lang="ts" setup generic="T">

type ISlots = {
  "last-columns": (props: T) => void
  "lastColumns": (props: string) => void
};
defineSlots<ISlots>();
</script>
