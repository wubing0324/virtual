<template>
  <div 
    class="parking-space-canvas"
    ref="canvasWrapper"
    :style="wrapperStyle"
  >
    <div 
      class="canvas-content"
      :style="contentStyle"
    >
      <!-- Background Image -->
      <img 
        v-if="imageSrc"
        :src="imageSrc"
        class="background-image"
        :style="backgroundImageStyle"
        alt="Background"
        @load="handleImageLoad"
      />
      <div 
        v-else
        class="background-placeholder"
        :style="backgroundPlaceholderStyle"
      ></div>

      <!-- Parking Space Boxes -->
        <div
          v-for="(box, index) in processedBoxes"
          :key="box.id || index"
          class="box-container"
          :class="{ 'high-conf': box.confidence > 0.8, 'hovered': hoveredBox === box }"
          :style="getBoxStyle(box)"
          @mouseenter="handleBoxEnter(box)"
          @mouseleave="handleBoxLeave"
        >
        <!-- Main Box (using clip-path for polygon) -->
        <div 
          class="box-polygon"
          :style="getPolygonStyle(box)"
        ></div>
        
        <!-- Direction Indicator -->
        <div
          v-if="hoveredBox === box"
          class="direction-indicator"
          :style="getDirectionIndicatorStyle(box)"
        ></div>

        <!-- Label -->
        <div
          v-if="showLabels || hoveredBox === box"
          class="box-label"
          :style="getLabelStyle(box)"
        >
          {{ box.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ParkingSpaceCanvas',
  props: {
    // 图片 URL 或路径
    imageSrc: {
      type: String,
      default: null,
    },
    // 绘制数据（新格式：{ metadata, recognitionConfig, spaces } 或旧格式数组）
    data: {
      type: [Object, Array],
      required: true,
    },
    // 是否显示标签
    showLabels: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      hoveredBox: null,
      imageWidth: 0,
      imageHeight: 0,
      wrapperWidth: 0,
      wrapperHeight: 0,
    };
  },
  computed: {
    // 处理数据，转换为统一的格式
    processedBoxes() {
      if (!this.data) return [];
      
      // 新格式：{ metadata, recognitionConfig, spaces: [...] }
      if (this.data.spaces && Array.isArray(this.data.spaces)) {
        return this.data.spaces.map(space => {
          // 处理 vertices：支持 [x, y] 数组或 {x, y} 对象格式
          let xyxyxyxy;
          if (space.vertices && Array.isArray(space.vertices) && space.vertices.length > 0) {
            xyxyxyxy = space.vertices.map(v => {
              if (Array.isArray(v)) {
                return [v[0], v[1]];
              } else if (v && typeof v === 'object' && 'x' in v && 'y' in v) {
                return [v.x, v.y];
              }
              return [0, 0];
            });
          } else {
            xyxyxyxy = this.calculateVerticesFromRect(space);
          }
          
          const angleRad = (space.angle || 0) * Math.PI / 180;
          
          return {
            id: space.id,
            name: space.spaceCode || space.number || `Space ${space.id}`,
            confidence: 1.0,
            xyxyxyxy: xyxyxyxy,
            xywhr: {
              center_x: space.centerX || space.x,
              center_y: space.centerY || space.y,
              width: space.width,
              height: space.height,
              angle_rad: angleRad,
              angle_deg: space.angle || 0,
            },
            angle_rad: angleRad,
            angle_deg: space.angle || 0,
            original: space,
          };
        });
      }
      
      // 兼容旧格式：数组格式
      if (Array.isArray(this.data)) {
        return this.data.flatMap(item => item.boxes || []);
      }
      
      return [];
    },
    // 获取图片尺寸（优先从 metadata，否则从实际图片）
    canvasWidth() {
      if (this.data && this.data.metadata && this.data.metadata.imageSize) {
        return this.data.metadata.imageSize.width;
      }
      if (this.imageWidth > 0) {
        return this.imageWidth;
      }
      return 1000; // 默认值
    },
    canvasHeight() {
      if (this.data && this.data.metadata && this.data.metadata.imageSize) {
        return this.data.metadata.imageSize.height;
      }
      if (this.imageHeight > 0) {
        return this.imageHeight;
      }
      return 1000; // 默认值
    },
    // 计算缩放比例
    scale() {
      if (this.wrapperWidth === 0 || this.wrapperHeight === 0) return 1;
      if (this.canvasWidth === 0 || this.canvasHeight === 0) return 1;
      
      const scaleX = this.wrapperWidth / this.canvasWidth;
      const scaleY = this.wrapperHeight / this.canvasHeight;
      
      // 使用较小的缩放比例，确保内容完全可见
      return Math.min(scaleX, scaleY, 1); // 不超过1，不放大
    },
    // 包装器样式
    wrapperStyle() {
      return {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      };
    },
    // 内容容器样式（应用缩放）
    contentStyle() {
      return {
        width: `${this.canvasWidth}px`,
        height: `${this.canvasHeight}px`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${this.scale})`,
        transformOrigin: 'center center',
      };
    },
    backgroundImageStyle() {
      return {
        width: `${this.canvasWidth}px`,
        height: `${this.canvasHeight}px`,
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        objectFit: 'none',
        pointerEvents: 'none',
      };
    },
    backgroundPlaceholderStyle() {
      return {
        width: `${this.canvasWidth}px`,
        height: `${this.canvasHeight}px`,
        backgroundColor: '#f8f9fa',
        border: '2px solid #ddd',
        position: 'absolute',
        top: 0,
        left: 0,
      };
    },
  },
  mounted() {
    this.updateWrapperSize();
    window.addEventListener('resize', this.updateWrapperSize);
    if (this.imageSrc) {
      this.loadImage();
    }
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.updateWrapperSize);
  },
  watch: {
    imageSrc() {
      if (this.imageSrc) {
        this.loadImage();
      }
    },
    data: {
      deep: true,
      handler() {
        // 数据变化时，可能需要重新计算
        this.$nextTick(() => {
          this.updateWrapperSize();
        });
      },
    },
  },
  methods: {
    handleBoxEnter(box) {
      this.hoveredBox = box;
      this.$emit('box-hover', box);
    },
    handleBoxLeave() {
      this.hoveredBox = null;
      this.$emit('box-hover', null);
    },
    updateWrapperSize() {
      if (this.$refs.canvasWrapper) {
        this.wrapperWidth = this.$refs.canvasWrapper.clientWidth;
        this.wrapperHeight = this.$refs.canvasWrapper.clientHeight;
      }
    },
    loadImage() {
      if (!this.imageSrc) return;
      
      const img = new Image();
      img.src = this.imageSrc;
      img.onload = () => {
        this.imageWidth = img.naturalWidth;
        this.imageHeight = img.naturalHeight;
        this.$nextTick(() => {
          this.updateWrapperSize();
        });
      };
    },
    handleImageLoad(event) {
      this.imageWidth = event.target.naturalWidth;
      this.imageHeight = event.target.naturalHeight;
      this.$nextTick(() => {
        this.updateWrapperSize();
      });
    },
    // 获取车位框的样式（容器定位）
    getBoxStyle(box) {
      if (!box.xyxyxyxy || box.xyxyxyxy.length < 4) {
        return {
          position: 'absolute',
          left: `${box.xywhr.center_x - box.xywhr.width / 2}px`,
          top: `${box.xywhr.center_y - box.xywhr.height / 2}px`,
          width: `${box.xywhr.width}px`,
          height: `${box.xywhr.height}px`,
          transformOrigin: 'center center',
          transform: `rotate(${box.xywhr.angle_deg}deg)`,
        };
      }
      
      const points = box.xyxyxyxy;
      const xs = points.map(p => p[0]);
      const ys = points.map(p => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      
      return {
        position: 'absolute',
        left: `${minX}px`,
        top: `${minY}px`,
        width: `${maxX - minX}px`,
        height: `${maxY - minY}px`,
      };
    },
    // 获取多边形的 clip-path 样式
    getPolygonStyle(box) {
      if (!box.xyxyxyxy || box.xyxyxyxy.length < 4) {
        return {
          width: '100%',
          height: '100%',
        };
      }
      
      const points = box.xyxyxyxy;
      const xs = points.map(p => p[0]);
      const ys = points.map(p => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      
      const containerWidth = maxX - minX;
      const containerHeight = maxY - minY;
      
      if (containerWidth === 0 || containerHeight === 0) {
        return {
          width: '100%',
          height: '100%',
        };
      }
      
      const clipPathPoints = points.map(([x, y]) => {
        const relX = ((x - minX) / containerWidth) * 100;
        const relY = ((y - minY) / containerHeight) * 100;
        return `${relX}% ${relY}%`;
      }).join(', ');
      
      return {
        width: '100%',
        height: '100%',
        clipPath: `polygon(${clipPathPoints})`,
        WebkitClipPath: `polygon(${clipPathPoints})`,
      };
    },
    // 获取方向指示器的样式
    getDirectionIndicatorStyle(box) {
      if (!box.xyxyxyxy || box.xyxyxyxy.length < 2) return {};
      
      const p1 = box.xyxyxyxy[0];
      const p2 = box.xyxyxyxy[1];
      const xs = box.xyxyxyxy.map(p => p[0]);
      const ys = box.xyxyxyxy.map(p => p[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      
      const x1 = p1[0] - minX;
      const y1 = p1[1] - minY;
      const x2 = p2[0] - minX;
      const y2 = p2[1] - minY;
      
      const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      
      return {
        position: 'absolute',
        left: `${x1}px`,
        top: `${y1}px`,
        width: `${length}px`,
        height: '2px',
        backgroundColor: 'red',
        transformOrigin: '0 50%',
        transform: `rotate(${angle}deg)`,
        pointerEvents: 'none',
      };
    },
    // 获取标签的样式
    getLabelStyle(box) {
      const xs = box.xyxyxyxy ? box.xyxyxyxy.map(p => p[0]) : [box.xywhr.center_x];
      const ys = box.xyxyxyxy ? box.xyxyxyxy.map(p => p[1]) : [box.xywhr.center_y];
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      
      const centerX = box.xywhr.center_x - minX;
      const centerY = box.xywhr.center_y - minY;
      
      return {
        position: 'absolute',
        left: `${centerX}px`,
        top: `${centerY}px`,
        transform: `translate(-50%, -50%) rotate(${box.xywhr.angle_deg}deg)`,
        transformOrigin: 'center center',
        pointerEvents: 'none',
      };
    },
    // 如果没有 vertices，从矩形参数计算四个顶点
    calculateVerticesFromRect(space) {
      const cx = space.centerX || space.x;
      const cy = space.centerY || space.y;
      const w = space.width || 0;
      const h = space.height || 0;
      const angle = (space.angle || 0) * Math.PI / 180;
      
      const halfW = w / 2;
      const halfH = h / 2;
      const corners = [
        [-halfW, -halfH],
        [halfW, -halfH],
        [halfW, halfH],
        [-halfW, halfH]
      ];
      
      return corners.map(([x, y]) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;
        return [cx + rotatedX, cy + rotatedY];
      });
    },
  },
};
</script>

<style scoped>
.parking-space-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.canvas-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
}

.background-image {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  pointer-events: none;
}

.background-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
}

.box-container {
  position: absolute;
  z-index: 1;
  cursor: pointer;
}

.box-polygon {
  width: 100%;
  height: 100%;
  background-color: rgba(33, 150, 243, 0.15);
  border: 2px solid #2196F3;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.box-container:hover .box-polygon {
  background-color: rgba(33, 150, 243, 0.4);
  border-width: 3px;
}

.box-container.high-conf .box-polygon {
  border-color: #00C853;
  background-color: rgba(0, 200, 83, 0.15);
}

.box-container.high-conf:hover .box-polygon {
  background-color: rgba(0, 200, 83, 0.4);
}

.direction-indicator {
  position: absolute;
  z-index: 2;
}

.box-label {
  font-size: 14px;
  color: #333;
  font-weight: 500;
  pointer-events: none;
  text-shadow: 0 1px 2px white, 0 -1px 2px white, 1px 0 2px white, -1px 0 2px white;
  white-space: nowrap;
  z-index: 3;
}
</style>
