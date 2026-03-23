<template>
  <div class="virtual-list-container">
    <section class="demo-section">
      <h3 class="demo-title">
        VirtualAutoList（纵向 · 企业级示例）
      </h3>
      <p class="demo-desc">
        ScrollEngine（engine.js）负责 rAF / offset / 启停与平滑滚动；组件负责虚拟行与 UI。
        支持 scrollToIndex、activeIndex、rowClassName、pauseOnHover、插槽。
      </p>
      <div class="demo-toolbar">
        <button type="button" @click="scrollTo(0)">
          滚到第 0 行
        </button>
        <button type="button" @click="scrollTo(10)">
          滚到第 10 行
        </button>
        <button type="button" @click="toggleActive">
          切换高亮行（当前 {{ activeIndex == null ? '无' : activeIndex }}）
        </button>
        <button type="button" @click="pauseHover = !pauseHover">
          pauseOnHover: {{ pauseHover }}
        </button>
        <button type="button" @click="insertRowHead">
          插入一行（头部）
        </button>
        <button type="button" @click="removeRowHead" :disabled="demoList.length === 0">
          删除一行（头部）
        </button>
        <button type="button" @click="insertRow">
          插入一行（尾部）
        </button>
        <button type="button" @click="removeRow" :disabled="demoList.length === 0">
          删除一行（尾部）
        </button>
        <span class="demo-meta">当前条数：{{ demoList.length }}</span>
      </div>
      <div class="demo-list-wrap">
        <virtual-auto-list
          ref="listRef"
          :data-list="demoList"
          :columns="demoColumns"
          :height="320"
          :row-height="48"
          :auto-scroll="true"
          :scroll-speed="28"
          :active-index="activeIndex"
          :pause-on-hover="pauseHover"
          :row-class-name="rowClassName"
          :stay-ms="1500"
          :transition-ms="320"
          @row-click="onRowClick"
          @scroll-end="onScrollEnd"
        />
      </div>
      <p v-if="lastEvent" class="demo-event">
        最近事件：{{ lastEvent }}
      </p>
    </section>

    <section class="demo-section">
      <h3 class="demo-title">
        横向 direction=&quot;horizontal&quot;
      </h3>
      <virtual-auto-list
        class="demo-horizontal"
        :data-list="demoListSmall"
        :columns="demoColumnsMini"
        :height="120"
        :row-height="100"
        direction="horizontal"
        :auto-scroll="true"
        :scroll-speed="40"
        :pause-on-hover="true"
      />
    </section>
  </div>
</template>

<script>
import VirtualAutoList from './VirtualAutoList.vue';

export default {
  name: 'VirtualListInner',
  components: {
    VirtualAutoList,
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
    const demoListSmall = demoList.slice(0, 12);
    return {
      demoList,
      demoListSmall,
      demoColumns: [
        { label: '名称', prop: 'name', width: 220 },
        { label: '状态', prop: 'status' },
        {
          label: '数量',
          prop: 'count',
          width: 120,
          render(h, row) {
            return h('span', { class: 'demo-count' }, `共 ${row.count} 条`);
          }
        }
      ],
      demoColumnsMini: [
        { label: '名称', prop: 'name', width: 120 },
        { label: '状态', prop: 'status', width: 120 }
      ],
      activeIndex: 3,
      pauseHover: true,
      lastEvent: '',
      /** 插入行用唯一 id，避免与现有 id 冲突 */
      nextDemoId: 200000
    };
  },
  methods: {
    /** 测试动态数据：头部插入 */
    insertRowHead() {
      const id = this.nextDemoId;
      this.nextDemoId += 1;
      const row = {
        id,
        name: `头部插入 #${id}`,
        status: '进行中',
        count: 0
      };
      this.demoList.unshift(row);
      this.notifyChange('add', `头部插入 #${id}`);
      this.lastEvent = `insert 头部，id=${id}，总条数=${this.demoList.length}`;
    },
    /** 测试动态数据：头部删除 */
    removeRowHead() {
      if (this.demoList.length === 0) return;
      const removed = this.demoList.shift();
      this.notifyChange('remove', `头部删除 #${removed.id}`);
      this.lastEvent = `remove 头部，id=${removed.id}，总条数=${this.demoList.length}`;
    },
    /** 测试动态数据：尾部插入 */
    insertRow() {
      const id = this.nextDemoId;
      this.nextDemoId += 1;
      const row = {
        id,
        name: `新插入 #${id}`,
        status: '进行中',
        count: 0
      };
      this.demoList.push(row);
      this.notifyChange('add', `尾部插入 #${id}`);
      this.lastEvent = `insert 尾部，id=${id}，总条数=${this.demoList.length}`;
    },
    /** 测试动态数据：尾部删除 */
    removeRow() {
      if (this.demoList.length === 0) return;
      const removed = this.demoList.pop();
      this.notifyChange('remove', `尾部删除 #${removed.id}`);
      this.lastEvent = `remove 尾部，id=${removed.id}，总条数=${this.demoList.length}`;
    },
    notifyChange(type, text) {
      const ref = this.$refs.listRef;
      if (ref && ref.notifyChange) {
        ref.notifyChange(type, text);
      }
    },
    scrollTo(index) {
      const ref = this.$refs.listRef;
      if (ref && ref.scrollToIndex) {
        ref.scrollToIndex(index, 600);
      }
    },
    toggleActive() {
      if (this.activeIndex == null) {
        this.activeIndex = 5;
      } else {
        this.activeIndex = this.activeIndex >= 10 ? null : this.activeIndex + 1;
      }
    },
    /** 演示 rowClassName：奇数行加 class */
    rowClassName(row, index) {
      return index % 2 === 1 ? 'demo-row-odd' : '';
    },
    onRowClick(row, index) {
      this.lastEvent = `row-click index=${index} name=${row.name}`;
    },
    onScrollEnd() {
      this.lastEvent = 'scroll-end（scrollToIndex 动画结束）';
    }
  }
};
</script>

<style scoped>
.virtual-list-container {
  padding: 16px;
  max-width: 960px;
}

.demo-section {
  margin-bottom: 32px;
}

.demo-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.demo-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.demo-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.demo-toolbar button {
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
}

.demo-toolbar button:hover {
  color: #409eff;
  border-color: #c6e2ff;
}

.demo-toolbar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.demo-meta {
  align-self: center;
  font-size: 13px;
  color: #606266;
}

.demo-event {
  margin: 12px 0 0;
  font-size: 12px;
  color: #909399;
}

.demo-list-wrap {
  position: relative;
}

.demo-horizontal {
  max-width: 100%;
}

.virtual-list-container >>> .demo-count {
  color: #409eff;
}

.virtual-list-container >>> .demo-row-odd {
  opacity: 0.92;
}
</style>
