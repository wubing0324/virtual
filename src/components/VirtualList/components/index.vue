<template>
  <div class="virtual-list-container">
    <virtual-auto-list
      :data-list="demoList"
      :columns="demoColumns"
      :height="320"
      :row-height="48"
      :auto-scroll="true"
    />
  </div>
</template>

<script>
import VirtualAutoList from './VirtualAutoList.vue';

export default {
  name: 'VirtualListInner',
  components: {
    VirtualAutoList
  },
  data() {
    const demoList = [];
    for (let i = 0; i < 20; i += 1) {
      demoList.push({
        id: i,
        name: `项目 ${i + 1}`,
        status: i % 3 === 0 ? '进行中' : i % 3 === 1 ? '已完成' : '待开始',
        count: (i * 7) % 24
      });
    }
    return {
      demoList,
      demoColumns: [
        { label: '名称', prop: 'name', width: 120 },
        { label: '状态', prop: 'status' },
        {
          label: '数量',
          prop: 'count',
          width: 80,
          render(h, row) {
            return h('span', { class: 'demo-count' }, `共 ${row.count} 条`);
          }
        }
      ]
    };
  }
};
</script>

<style scoped>
.virtual-list-container {
  padding: 16px;
}

.virtual-list-container >>> .demo-count {
  color: #409eff;
}
</style>
