<template>
  <div
    class="virtual-auto-list"
    :style="{ height: height + 'px' }"
  >
    <!-- 表头与列表区域分离，表头不参与纵向滚动 -->
    <div ref="headerRef" class="virtual-auto-list__header">
      <div
        v-for="(col, colIndex) in columns"
        :key="col.prop || colIndex"
        class="virtual-auto-list__cell virtual-auto-list__cell--header"
        :style="columnCellStyles[colIndex]"
      >
        {{ col.label }}
      </div>
    </div>

    <!--
      视口：overflow hidden，无 scrollTop 驱动；自动滚由 rAF 更新 offset + transform 完成
      hover 时暂停 rAF
    -->
    <div
      ref="bodyRef"
      class="virtual-auto-list__body"
      @mouseenter="onBodyMouseEnter"
      @mouseleave="onBodyMouseLeave"
    >
      <div
        class="virtual-auto-list__list"
        :style="listTransformStyle"
      >
        <div
          v-for="(item, i) in visibleRows"
          :key="'vr-' + i"
          class="virtual-auto-list__row"
          :class="{ 'is-last-visible': i === visibleRows.length - 1 }"
          :style="rowStyle"
          @click="onRowClick(item.row, item.index)"
        >
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
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/** 可视区上下多渲染的行数，减轻快速滚动时露底 */
const BUFFER = 5;

const ColumnCell = {
  functional: true,
  props: {
    column: { type: Object, required: true },
    row: { type: Object, required: true },
    index: { type: Number, required: true }
  },
  render(h, ctx) {
    return ctx.props.column.render(h, ctx.props.row, ctx.props.index);
  }
};

export default {
  name: 'VirtualAutoList',
  components: {
    ColumnCell
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
    }
  },
  data() {
    return {
      /**
       * 纵向像素偏移（连续累加，逻辑上在 [0, totalHeight) 内用取模循环）
       * 核心：offset = (offset + speed * dt) % totalHeight
       */
      offset: 0,
      /** 列表可视区高度（用于 visibleCount） */
      bodyHeight: 0,
      resizeObserver: null,
      rafId: null,
      lastTime: 0,
      /** hover 时暂停 rAF，不推进 offset */
      isHoverPaused: false,
      /**
       * 用于 dataList / rowHeight 变化时按比例恢复 offset（更新前缓存的总高度）
       */
      cachedTotalHeight: 0,
      _offsetSyncScheduled: false
    };
  },
  computed: {
    /** 行高取整，保证 totalHeight、取模与 translate 对齐 */
    normalizedRowHeight() {
      return Math.max(1, Math.round(Number(this.rowHeight) || 1));
    },
    /** 一份列表总高度 = 行数 * 行高；无限循环时 offset 对该值取模 */
    totalHeight() {
      return this.dataList.length * this.normalizedRowHeight;
    },
    /**
     * 当前「逻辑」起始行下标：由像素偏移换算而来
     * offset ∈ [0, totalHeight) ⇒ startIndex ∈ [0, n-1]
     */
    startIndex() {
      const n = this.dataList.length;
      if (!n) return 0;
      const rh = this.normalizedRowHeight;
      return Math.floor(this.offset / rh) % n;
    },
    /**
     * 可视行数：ceil(视口高/行高) + buffer
     * 视口高优先用 body 实测，未就绪时用 height 估算（扣表头）
     */
    visibleCount() {
      const rh = this.normalizedRowHeight;
      const bh =
        this.bodyHeight > 0
          ? this.bodyHeight
          : Math.max(rh, this.height - 44);
      return Math.ceil(bh / rh) + BUFFER;
    },
    /**
     * 虚拟窗口：从 startIndex 起连续取 visibleCount 行，下标对 n 取模实现「不复制数据」的环形衔接
     */
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
    /**
     * 行内亚像素偏移：offset % rowHeight，整段列表向上平移该值，实现行间无缝衔接
     */
    translateSubPx() {
      const rh = this.normalizedRowHeight;
      if (rh <= 0) return 0;
      // 与 offset 同余，避免浮点误差
      const t = this.offset - Math.floor(this.offset / rh) * rh;
      return t;
    },
    /** 仅作用于当前可视行块，不做 keyframes */
    listTransformStyle() {
      const y = this.translateSubPx;
      return {
        transform: `translate3d(0, ${-y}px, 0)`
      };
    },
    rowStyle() {
      return { height: `${this.normalizedRowHeight}px` };
    },
    columnCellStyles() {
      return this.columns.map((col) => {
        if (col.width != null) {
          return {
            flex: `0 0 ${col.width}px`,
            width: `${col.width}px`,
            minWidth: 0
          };
        }
        return {
          flex: '1 1 0',
          minWidth: 0
        };
      });
    }
  },
  watch: {
    dataList: {
      handler: 'scheduleOffsetRatioSync',
      deep: false
    },
    'dataList.length': 'scheduleOffsetRatioSync',
    rowHeight: 'scheduleOffsetRatioSync',
    autoScroll: {
      handler(enabled) {
        if (enabled) {
          this.startAnimationLoop();
        } else {
          this.stopAnimationLoop();
        }
      },
      immediate: false
    }
  },
  mounted() {
    this.cachedTotalHeight = this.totalHeight;
    this.$nextTick(() => {
      this.measureBody();
      this.resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
            this.measureBody();
          })
          : null;
      if (this.resizeObserver && this.$refs.bodyRef) {
        this.resizeObserver.observe(this.$refs.bodyRef);
      }
      if (this.autoScroll && this.totalHeight > 0) {
        this.startAnimationLoop();
      }
    });
  },
  beforeDestroy() {
    this.stopAnimationLoop();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  },
  methods: {
    measureBody() {
      const el = this.$refs.bodyRef;
      if (!el) return;
      const h = el.clientHeight;
      if (h !== this.bodyHeight) {
        this.bodyHeight = h;
      }
    },
    /**
     * dataList / length / rowHeight 可能同帧触发多次，合并为一次比例同步
     */
    scheduleOffsetRatioSync() {
      if (this._offsetSyncScheduled) return;
      this._offsetSyncScheduled = true;
      this.$nextTick(() => {
        this._offsetSyncScheduled = false;
        this.applyOffsetRatioSync();
      });
    },
    /**
     * 数据或行高变化：按旧总高比例映射新 offset，避免列表跳动
     * ratio = offset / oldTotalHeight → offset' = ratio * newTotalHeight
     */
    applyOffsetRatioSync() {
      const oldTh = this.cachedTotalHeight;
      const newTh = this.totalHeight;
      if (oldTh > 0 && newTh > 0) {
        this.offset = (this.offset / oldTh) * newTh;
      }
      if (newTh > 0) {
        this.offset = this.offset % newTh;
      } else {
        this.offset = 0;
      }
      this.cachedTotalHeight = newTh;
      if (this.autoScroll && newTh > 0 && this.rafId == null && !this.isHoverPaused) {
        this.startAnimationLoop();
      }
    },
    /**
     * 自动滚动主循环：仅用 rAF + 修改 offset，禁止 scrollTop / CSS keyframes
     */
    tick(ts) {
      if (!this.autoScroll) {
        this.rafId = null;
        return;
      }
      if (this.isHoverPaused) {
        this.rafId = null;
        return;
      }
      const th = this.totalHeight;
      if (th <= 0 || !this.dataList.length) {
        this.rafId = null;
        return;
      }
      if (!this.lastTime) {
        this.lastTime = ts;
      }
      const dt = Math.min(0.064, Math.max(0, (ts - this.lastTime) / 1000));
      this.lastTime = ts;
      // 核心：像素累加后对 totalHeight 取模，实现无限循环且不复制数据（双模消除负数）
      const next = this.offset + this.scrollSpeed * dt;
      this.offset = ((next % th) + th) % th;
      this.rafId = requestAnimationFrame((t) => this.tick(t));
    },
    startAnimationLoop() {
      if (!this.autoScroll || this.rafId != null) return;
      if (this.totalHeight <= 0 || !this.dataList.length) return;
      this.lastTime = 0;
      this.rafId = requestAnimationFrame((t) => this.tick(t));
    },
    stopAnimationLoop() {
      if (this.rafId != null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.lastTime = 0;
    },
    /** hover：停止 rAF（不推进 offset） */
    onBodyMouseEnter() {
      this.isHoverPaused = true;
      this.stopAnimationLoop();
    },
    /** 离开：恢复 rAF */
    onBodyMouseLeave() {
      this.isHoverPaused = false;
      if (this.autoScroll && this.totalHeight > 0) {
        this.startAnimationLoop();
      }
    },
    onRowClick(row, index) {
      this.$emit('row-click', row, index);
    },
    getRowKey(row, index) {
      if (typeof this.rowKey === 'string' && this.rowKey) {
        const k = row[this.rowKey];
        return k != null ? k : `__row_${index}`;
      }
      if (typeof this.rowKey === 'function') {
        return this.rowKey(row, index);
      }
      if (row && row.id != null) return row.id;
      if (row && row.key != null) return row.key;
      return `__row_${index}`;
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
  overflow: hidden;
  position: relative;
}

.virtual-auto-list__list {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  will-change: transform;
}

.virtual-auto-list__row {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  border-bottom: 1px solid #ebeef5;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.virtual-auto-list__row:hover {
  background-color: #ecf5ff;
}

.virtual-auto-list__row.is-last-visible {
  border-bottom: none;
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
