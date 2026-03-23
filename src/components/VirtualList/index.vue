<template>
  <div class="virtual-list-container-use">
    <virtual-list-inner />
  </div>
</template>

<script>
import VirtualListInner from './components/index.vue';

export default {
  name: 'VirtualListUse',
  components: {
    VirtualListInner
  },
  data() {
    return {};
  }
};
</script>

<style scoped>
.virtual-list-container-use {
  padding: 16px;
}
</style>
