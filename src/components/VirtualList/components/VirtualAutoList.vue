<template>
  <div
    class="virtual-auto-list"
    :class="rootClass"
    :style="wrapperInlineStyle"
  >
    <div v-if="showHeaderAll" ref="headerRef" class="virtual-auto-list__header">
      <slot name="header">
        <div
          v-for="(col, colIndex) in columns"
          :key="col.prop || colIndex"
          class="virtual-auto-list__cell virtual-auto-list__cell--header"
          :style="columnCellStyles[colIndex]"
        >
          {{ col.label }}
        </div>
      </slot>
    </div>

    <div
      ref="bodyRef"
      class="virtual-auto-list__body"
      @mouseenter="onBodyMouseEnter"
      @mouseleave="onBodyMouseLeave"
      @wheel.prevent="onBodyWheel"
    >
      <div
        class="virtual-auto-list__list"
        :class="listClass"
        :style="listTransformStyle"
      >
        <!--
          斑马线：等价于 :class="['row', { 'is-striped': stripe && realIndex(i)%2===1 }]"
          必须用 realIndex(i)%2，禁止 i%2；此处合并为 rowClassBinding 以展开 rowClassList 数组
        -->
        <div
          v-for="(item, i) in visibleRows"
          :key="stableRowDomKey(item, i)"
          :class="rowClassBinding(item, i)"
          :style="rowInlineStyle"
          @click="onRowClick(item.row, item.index)"
        >
          <slot name="row" :row="item.row" :index="item.index">
            <div
              v-for="(col, colIndex) in columns"
              :key="col.prop || colIndex"
              class="virtual-auto-list__cell"
              :style="columnCellStyles[colIndex]"
            >
              <column-cell
                v-if="col.render"
                :column="col"
                :row="item.row"
                :index="item.index"
              />
              <span v-else class="virtual-auto-list__cell-text">{{ item.row[col.prop] }}</span>
            </div>
          </slot>
        </div>
      </div>
    </div>
    <data-change-notice :stay-ms="1500" :transition-ms="320" ref="changeNoticeRef" />
  </div>
</template>

<script>
import { ScrollEngine } from './engine.js';
import DataChangeNotice from './DataChangeNotice.vue';

const BUFFER = 5;

const ColumnCell = {
  functional: true,
  props: {
    column: { type: Object, required: true },
    row: { type: Object, required: true },
    index: { type: Number, required: true }
  },
  render(h, ctx) {
    const vnode = ctx.props.column.render(h, ctx.props.row, ctx.props.index);
    /** render 返回 undefined 时会产生非法子节点，触发 sameVnode 读 undefined.key */
    return vnode != null ? vnode : h('span', { staticClass: 'virtual-auto-list__cell-empty' });
  }
};

export default {
  name: 'VirtualAutoList',
  components: {
    ColumnCell,
    DataChangeNotice
  },
  props: {
    dataList: {
      type: Array,
      default: () => []
    },
    columns: {
      type: Array,
      default: () => []
    },
    height: {
      type: Number,
      default: 300
    },
    /** 沿滚动方向的单格尺寸：纵向=行高，横向=每列宽度 */
    rowHeight: {
      type: Number,
      default: 50
    },
    autoScroll: {
      type: Boolean,
      default: true
    },
    scrollSpeed: {
      type: Number,
      default: 30
    },
    rowKey: {
      type: [String, Function],
      default: null
    },
    /** vertical | horizontal */
    direction: {
      type: String,
      default: 'vertical',
      validator: (v) => v === 'vertical' || v === 'horizontal'
    },
    /** 鼠标进入列表是否暂停自动滚（引擎层 hover 标记） */
    pauseOnHover: {
      type: Boolean,
      default: true
    },
    /** 高亮行逻辑下标；仅样式，不驱动滚动，也不打断引擎 */
    activeIndex: {
      default: null,
      validator: (v) =>
        v === null ||
        v === undefined ||
        (typeof v === 'number' && !Number.isNaN(v))
    },
    /** 追加行 class： (row, index) => string */
    rowClassName: {
      type: Function,
      default: null
    },
    /** 斑马线：按真实数据索引奇偶着色（基于 realIndex，非视口下标 i） */
    stripe: {
      type: Boolean,
      default: true
    },
    /** scrollToIndex 默认动画时长（ms） */
    scrollToDuration: {
      type: Number,
      default: 500
    },
    /** 数据变更提示停留时长（ms） */
    stayMs: {
      type: Number,
      default: 1500
    },
    /** 数据变更提示过渡时长（ms） */
    transitionMs: {
      type: Number,
      default: 320
    },
    showChangeNotice: {
      type: Boolean,
      default: true
    },
    showHeader: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      /** 与 ScrollEngine 同步的像素偏移（视图唯一展示源） */
      offset: 0,
      /** 纵向：body 高度；横向：body 宽度 */
      bodyMainSize: 0,
      resizeObserver: null,
      cachedTotalLength: 0,
      /** 合并同帧多次 dataList / length 变更 */
      dataListSyncScheduled: false,
      dataListSyncPendingAgain: false,
      pendingOldListSnapshot: null,
      /**
       * 上一次同步完成后的 dataList 浅拷贝，用于 push 等「同引用」场景下作为 oldList
       * 与 prevItemSize 一起计算 oldTotalHeight
       */
      prevListSnapshot: [],
      prevItemSize: null,
      engine: null
    };
  },
  computed: {
    isHorizontal() {
      return this.direction === 'horizontal';
    },
    rootClass() {
      return {
        'is-horizontal': this.isHorizontal,
        'is-vertical': !this.isHorizontal
      };
    },
    showHeaderAll() {
      return this.showHeader && (this.columns && this.columns.length > 0) || !!this.$slots.header;
    },
    wrapperInlineStyle() {
      return { height: `${this.height}px` };
    },
    listClass() {
      return {
        'is-horizontal': this.isHorizontal,
        'is-vertical': !this.isHorizontal
      };
    },
    /** 滚动方向上的单格像素，取整避免取模与 transform 漂移 */
    normalizedItemSize() {
      return Math.max(1, Math.round(Number(this.rowHeight) || 1));
    },
    /** 一份数据轨道总长 = n * itemSize（无限循环取模基准） */
    totalTrackLength() {
      return this.dataList.length * this.normalizedItemSize;
    },
    startIndex() {
      const n = this.dataList.length;
      if (!n) return 0;
      const size = this.normalizedItemSize;
      return Math.floor(this.offset / size) % n;
    },
    /** 视口主轴能容纳的格数 + buffer（纵向用高，横向用宽） */
    visibleCount() {
      const size = this.normalizedItemSize;
      const main =
        this.bodyMainSize > 0
          ? this.bodyMainSize
          : Math.max(
            size,
            this.isHorizontal
              ? this.height
              : Math.max(size, this.height - 44)
          );
      return Math.ceil(main / size) + BUFFER;
    },
    /** 环形虚拟窗口：下标取模，不复制 dataList */
    visibleRows() {
      const n = this.dataList.length;
      if (!n) return [];
      const start = this.startIndex;
      const count = this.visibleCount;
      const list = this.dataList;
      const out = [];
      for (let i = 0; i < count; i += 1) {
        const index = (start + i) % n;
        out.push({ row: list[index], index });
      }
      return out;
    },
    translateSubPx() {
      const size = this.normalizedItemSize;
      if (size <= 0) return 0;
      return this.offset - Math.floor(this.offset / size) * size;
    },
    /** 主轴 transform：纵向平移 Y，横向平移 X */
    listTransformStyle() {
      const sub = this.translateSubPx;
      if (this.isHorizontal) {
        return { transform: `translate3d(${-sub}px, 0, 0)` };
      }
      return { transform: `translate3d(0, ${-sub}px, 0)` };
    },
    rowInlineStyle() {
      const s = this.normalizedItemSize;
      if (this.isHorizontal) {
        return {
          width: `${s}px`,
          height: '100%',
          flexShrink: 0
        };
      }
      return { height: `${s}px` };
    },
    columnCellStyles() {
      return this.columns.map((col) => {
        const align = ['left', 'center', 'right'].includes(col && col.align)
          ? col.align
          : 'left';
        const alignStyle = {
          textAlign: align,
          justifyContent:
            align === 'center'
              ? 'center'
              : align === 'right'
                ? 'flex-end'
                : 'flex-start'
        };
        if (col.width != null) {
          return {
            flex: `0 0 ${col.width}px`,
            width: `${col.width}px`,
            minWidth: 0,
            ...alignStyle
          };
        }
        return {
          flex: '1 1 0',
          minWidth: 0,
          ...alignStyle
        };
      });
    },
    dataListLength() {
      return Array.isArray(this.dataList) ? this.dataList.length : 0;
    }
  },
  watch: {
    dataList: {
      handler(newVal, oldVal) {
        this.scheduleDataListOffsetSync(oldVal);
      },
      deep: false
    },
    dataListLength() {
      /** 同引用 push/splice 时 shallow 的 dataList 可能不触发，仅靠 length */
      this.scheduleDataListOffsetSync(null);
    },
    rowHeight: 'onRowHeightChange',
    scrollSpeed(val) {
      if (this.engine) this.engine.setScrollSpeed(val);
    },
    autoScroll(val) {
      if (this.engine) this.engine.setAutoScroll(val);
    },
    pauseOnHover() {
      /* 仅影响后续 hover；当前若已暂停需用户移出再进 */
    }
  },
  mounted() {
    this.cachedTotalLength = this.totalTrackLength;
    this.prevListSnapshot = (this.dataList || []).slice();
    this.prevItemSize = this.normalizedItemSize;
    this.$nextTick(() => {
      this.measureBody();
      this.initEngine();
      this.resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
            this.measureBody();
          })
          : null;
      if (this.resizeObserver && this.$refs.bodyRef) {
        this.resizeObserver.observe(this.$refs.bodyRef);
      }
      if (this.autoScroll && this.totalTrackLength > 0) {
        this.engine.start();
      }
    });
  },
  beforeDestroy() {
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  },
  methods: {
    notifyChange(type, text) {
      if (!this.showChangeNotice) return;
      const ref = this.$refs.changeNoticeRef;
      if (!ref || !text) return;
      if (type === 'add') ref.notifyAdd(text);
      else ref.notifyRemove(text);
    },
    /** 创建引擎：getter 闭包读取当前组件状态，便于扩展 */
    initEngine() {
      this.engine = new ScrollEngine({
        getTotalLength: () => this.totalTrackLength,
        getItemSize: () => this.normalizedItemSize,
        getItemCount: () => this.dataList.length,
        scrollSpeed: this.scrollSpeed,
        onUpdate: (o) => {
          this.offset = o;
        },
        onSmoothEnd: () => {
          this.$emit('scroll-end');
        }
      });
      this.engine.setOffset(this.offset);
      this.engine.setAutoScroll(this.autoScroll);
    },
    measureBody() {
      const el = this.$refs.bodyRef;
      if (!el) return;
      const next = this.isHorizontal ? el.clientWidth : el.clientHeight;
      if (next !== this.bodyMainSize) {
        this.bodyMainSize = next;
      }
    },
    /**
     * dataList 引用变化或 length 变化时调度；oldList 优先用 watch 的 oldVal，否则用 _prevListSnapshot
     */
    scheduleDataListOffsetSync(oldValFromWatch) {
      const oldListSnapshot = Array.isArray(oldValFromWatch)
        ? oldValFromWatch.slice()
        : this.prevListSnapshot.slice();
      if (this.dataListSyncScheduled) {
        if (!this.pendingOldListSnapshot) {
          this.pendingOldListSnapshot = oldListSnapshot;
        }
        this.dataListSyncPendingAgain = true;
        return;
      }
      this.pendingOldListSnapshot = oldListSnapshot;
      this.dataListSyncScheduled = true;
      this.$nextTick(() => {
        this.dataListSyncScheduled = false;
        const oldList = this.pendingOldListSnapshot
          ? this.pendingOldListSnapshot.slice()
          : this.prevListSnapshot.slice();
        this.pendingOldListSnapshot = null;
        const newList = (this.dataList || []).slice();
        this.applyDataListOffsetSync(oldList);
        this.prevListSnapshot = newList.slice();
        this.prevItemSize = this.normalizedItemSize;
        this.cachedTotalLength = this.totalTrackLength;
        if (this.autoScroll && this.totalTrackLength > 0) {
          this.engine.start();
        }
        if (this.dataListSyncPendingAgain) {
          this.dataListSyncPendingAgain = false;
          this.scheduleDataListOffsetSync(null);
        }
      });
    },
    /** 仅行高变化：old/new 同一条数据，用比例或锚点下标保持视觉位置 */
    onRowHeightChange() {
      this.scheduleDataListOffsetSync(this.dataList);
    },
    /**
     * 数据动态增删：优先按「当前视口首行」锚点在 id / rowKey 上对齐；失败则比例回退；再尝试邻行锚点
     * 禁止无故 offset=0；最终对 newTotalLength 取模防越界，不中断自动滚（仍由引擎 start 恢复）
     */
    applyDataListOffsetSync(oldList) {
      if (!this.engine) return;
      const newList = this.dataList || [];
      const newSz = this.normalizedItemSize;
      const oldSz = this.prevItemSize != null ? this.prevItemSize : newSz;
      const oldN = oldList ? oldList.length : 0;
      const newN = newList.length;
      const oldTotal = oldN * oldSz;
      const newTotal = newN * newSz;

      if (newTotal <= 0) {
        this.engine.setOffset(0);
        return;
      }
      if (oldN <= 0 || oldTotal <= 0) {
        this.engine.setOffset(((this.offset % newTotal) + newTotal) % newTotal);
        return;
      }

      const oldStart = Math.floor(this.offset / oldSz) % oldN;
      const subOld =
        this.offset - Math.floor(this.offset / oldSz) * oldSz;

      let nextOffset = this.tryAnchorOffset(oldList, oldStart, oldSz, newList, newSz, subOld);

      if (nextOffset == null) {
        const ratio = this.offset / oldTotal;
        nextOffset = ratio * newTotal;
      }

      nextOffset = ((nextOffset % newTotal) + newTotal) % newTotal;
      this.engine.setOffset(nextOffset);
    },
    /**
     * 方式2：当前首行对应数据在新列表中的下标 → offset = newIndex * newSz + sub（不超过一格）
     * 找不到则邻行尝试；仍找不到返回 null 走比例
     */
    tryAnchorOffset(oldList, oldStart, oldSz, newList, newSz, subOld) {
      const newN = newList.length;
      if (!newN) return null;
      const maxSub = Math.max(0, newSz - 1e-6);
      const sub = Math.min(Math.max(0, subOld), maxSub);
      const deltas = [0, -1, 1, -2, 2, -3, 3];
      for (let k = 0; k < deltas.length; k += 1) {
        const idx = oldStart + deltas[k];
        if (idx < 0 || idx >= oldList.length) continue;
        const row = oldList[idx];
        const ni = this.findRowIndexInNewList(row, newList);
        if (ni >= 0) {
          return ni * newSz + sub;
        }
      }
      return null;
    },
    /** 用 id 优先，其次 rowKey 字段匹配 */
    findRowIndexInNewList(row, newList) {
      if (!row || !newList.length) return -1;
      if (row.id != null) {
        const i = newList.findIndex((r) => r && r.id === row.id);
        if (i >= 0) return i;
      }
      if (typeof this.rowKey === 'string' && this.rowKey) {
        const keyVal = row[this.rowKey];
        if (keyVal != null) {
          const i = newList.findIndex(
            (r) => r && r[this.rowKey] === keyVal
          );
          if (i >= 0) return i;
        }
      }
      return -1;
    },
    /**
     * 行节点 key：带视口下标 i，避免环形重复行时 id 重复导致 patch 异常
     *（同一 row 可能在 visibleRows 中出现多次）
     */
    stableRowDomKey(item, i) {
      if (!item) {
        return `vr-fallback-${i}`;
      }
      const row = item.row;
      if (row && row.id != null) {
        return `id-${row.id}-v${i}`;
      }
      if (typeof this.rowKey === 'string' && row && row[this.rowKey] != null) {
        return `${this.rowKey}-${row[this.rowKey]}-v${i}`;
      }
      return `vr-${item.index}-${i}`;
    },
    onBodyMouseEnter() {
      if (!this.pauseOnHover || !this.engine) return;
      this.engine.setHoverPaused(true);
    },
    onBodyMouseLeave() {
      if (!this.engine) return;
      this.engine.setHoverPaused(false);
    },
    /**
     * 手动滚动（不显示原生滚动条）：
     * - vertical: 使用 deltaY
     * - horizontal: 优先 deltaX，没有时回退 deltaY
     */
    onBodyWheel(ev) {
      const delta = this.isHorizontal
        ? (Math.abs(ev.deltaX) > 0 ? ev.deltaX : ev.deltaY)
        : ev.deltaY;
      if (!delta) return;
      if (this.engine) {
        this.engine.setOffset(this.offset + delta);
      } else {
        this.offset += delta;
      }
    },
    /**
     * 对外 API：平滑滚到指定逻辑行（easeInOut 在引擎内）
     * @param {number} index
     * @param {number} [durationMs]
     */
    scrollToIndex(index, durationMs) {
      if (!this.engine) return;
      const d =
        durationMs != null ? durationMs : this.scrollToDuration;
      this.engine.scrollToIndex(index, d);
    },
    /** 业务暂停自动滚（与 hover 无关，需 resume 恢复） */
    pause() {
      if (this.engine) this.engine.pause();
    },
    resume() {
      if (this.engine) this.engine.resume();
    },
    onRowClick(row, index) {
      this.$emit('row-click', row, index);
    },
    /**
     * 真实数据行下标（与 item.index 一致）：(startIndex + i) % dataList.length
     * 用于斑马线奇偶，避免仅用视口 i 导致循环滚动时颜色跳变
     */
    realIndex(i) {
      const n = this.dataList.length;
      if (!n) return 0;
      return (this.startIndex + i) % n;
    },
    /**
     * 行 class：BEM + row + 扩展 + { is-striped }（stripe 且 realIndex 为奇数）
     */
    rowClassBinding(item, i) {
      return [
        'virtual-auto-list__row',
        'row',
        ...this.rowClassList(item, i),
        { 'is-striped': this.stripe && this.realIndex(i) % 2 === 1 }
      ];
    },
    rowClassList(item, i) {
      const list = [];
      if (this.activeIndex != null && this.activeIndex === item.index) {
        list.push('virtual-auto-list__row--active');
      }
      if (this.rowClassName) {
        const extra = this.rowClassName(item.row, item.index);
        if (extra) {
          extra.split(/\s+/).forEach((c) => c && list.push(c));
        }
      }
      if (i === this.visibleRows.length - 1) {
        list.push('is-last-visible');
      }
      return list;
    }
  }
};
</script>

<style scoped>
.virtual-auto-list {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
}

.virtual-auto-list__header {
  display: flex;
  flex-shrink: 0;
  align-items: stretch;
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 600;
  font-size: 13px;
  color: #606266;
}

.virtual-auto-list__body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.virtual-auto-list__list {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
  display: flex;
}

.virtual-auto-list__list.is-vertical {
  flex-direction: column;
  right: 0;
}

.virtual-auto-list__list.is-horizontal {
  flex-direction: row;
  height: 100%;
  bottom: 0;
}

.virtual-auto-list__row {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

/* 斑马线：按真实数据索引奇偶，与无限循环 offset 一致，不随视口 i 闪烁 */
.row.is-striped {
  background: rgba(0, 0, 0, 0.03);
}

.is-vertical .virtual-auto-list__row {
  border-bottom: 1px solid #ebeef5;
}

.is-horizontal .virtual-auto-list__row {
  border-right: 1px solid #ebeef5;
  border-bottom: none;
}

.virtual-auto-list__row:hover {
  background-color: #ecf5ff;
}

.virtual-auto-list__row--active {
  background-color: #e6f7ff;
}

.is-vertical .virtual-auto-list__row--active {
  box-shadow: inset 3px 0 0 #409eff;
}

.is-horizontal .virtual-auto-list__row--active {
  box-shadow: inset 0 3px 0 0 #409eff;
}

.is-vertical .virtual-auto-list__row.is-last-visible {
  border-bottom: none;
}

.is-horizontal .virtual-auto-list__row.is-last-visible {
  border-right: none;
}

.virtual-auto-list__cell {
  display: flex;
  align-items: center;
  padding: 0 12px;
  box-sizing: border-box;
  font-size: 13px;
  color: #303133;
}

.virtual-auto-list__cell--header {
  padding-top: 10px;
  padding-bottom: 10px;
}

.virtual-auto-list__cell-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}
</style>
