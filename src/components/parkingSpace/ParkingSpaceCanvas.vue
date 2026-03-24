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
        <!-- Main Box (using clip-path for polygon) 测试用的所有车位位置绘制，用于确定json中数据是否齐全-->
        <!-- <div 
          class="box-polygon"
          :style="getPolygonStyle(box)"
        ></div> -->
        
        <!-- 车辆进入动画标签 -->
        <ParkingEntryAnimation
          v-if="isEntryAnimating(box.name)"
          :box="box"
          :entry-info="entryAnimations[box.name]"
          @animationend="handleEntryAnimationEnd(box.name)"
        >
          <!-- 可以通过 slot 自定义车牌信息样式 -->
          <!-- 
          <template #default="{ spaceCode, plateNum, plateType }">
            <div class="custom-animation-content">
              <span class="custom-space-code">{{ spaceCode }}</span>
              <span class="custom-plate-num">{{ plateNum }}</span>
            </div>
          </template>
          -->
        </ParkingEntryAnimation>
        
        <!-- Direction Indicator -->
        <div
          v-if="hoveredBox === box"
          class="direction-indicator"
          :style="getDirectionIndicatorStyle(box)"
        ></div>

        <!-- Label (只在有车辆进入动画时显示) -->
        <div
          v-if="shouldShowLabel(box) && isEntryAnimating(box.name)"
          class="space-label"
          :style="getLabelStyle(box)"
        >
          {{ getLabelText(box) }}
        </div>

      </div>
    </div>
  </div>
</template>

<script>
import ParkingEntryAnimation from './ParkingEntryAnimation.vue'

export default {
  name: 'ParkingSpaceCanvas',
  components: {
    ParkingEntryAnimation,
  },
  props: {
    imageSrc: {
      type: String,
      default: '',
    },
    jsonData: {
      type: Object,
      default: null,
    },
    // 接收需要触发动画的车辆信息
    entryInfo: {
      type: Object,
      default: null,
    },
    // 接收需要清除动画的信息 { spaceCode, plateNum }
    clearInfo: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      hoveredBox: null,
      imageWidth: 0,
      imageHeight: 0,
      wrapperWidth: 0,
      wrapperHeight: 0,
      entryAnimations: {}, // 进入动画映射 { spaceCode: { plateNum, plateType } }
    };
  },
  computed: {
    // 处理数据，转换为统一的格式
    processedBoxes() {
      if (!this.jsonData) return [];
      
      // 新格式：{ metadata, recognitionConfig, spaces: [...] }
      if (this.jsonData.spaces && Array.isArray(this.jsonData.spaces)) {
        return this.jsonData.spaces.map(space => {
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
              center_x: (space.centerX ?? ((space.x ?? 0) + (space.width ?? 0) / 2)),
              center_y: (space.centerY ?? ((space.y ?? 0) + (space.height ?? 0) / 2)),
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
      if (Array.isArray(this.jsonData)) {
        return this.jsonData.flatMap(item => item.boxes || []);
      }
      
      return [];
    },
    // 获取图片尺寸（优先从 metadata，否则从实际图片）
    canvasWidth() {
      if (this.jsonData && this.jsonData.metadata && this.jsonData.metadata.imageSize) {
        return this.jsonData.metadata.imageSize.width;
      }
      if (this.imageWidth > 0) {
        return this.imageWidth;
      }
      return 1000; // 默认值
    },
    canvasHeight() {
      if (this.jsonData && this.jsonData.metadata && this.jsonData.metadata.imageSize) {
        return this.jsonData.metadata.imageSize.height;
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
    // data: {
    //   deep: true,
    //   handler() {
    //     // 数据变化时，可能需要重新计算
    //     this.$nextTick(() => {
    //       this.updateWrapperSize();
    //     });
    //   },
    // },
    // 监听 entryInfo 变化，触发动画
    entryInfo: {
      handler(newInfo) {
        if (newInfo && newInfo.spaceCode) {
          console.log('收到车辆进入信息:', newInfo);
          this.triggerEntryAnimation(newInfo);
        }
      },
      immediate: false,
      deep: true,
    },
    // 监听 clearInfo 变化，清除动画
    clearInfo: {
      handler(clearData) {
        if (clearData) {
          if (clearData.spaceCode) {
            // 清除指定车位的动画（同时匹配 spaceCode 和 plateNum）
            this.clearEntryAnimation(clearData.spaceCode, clearData.plateNum);
          } else if (clearData.plateNum) {
            // 根据车牌号清除动画（需要查找对应的 spaceCode）
            this.clearEntryAnimationByPlateNum(clearData.plateNum);
          }
        }
      },
      immediate: false,
      deep: true,
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
    // 如果没有 vertices，从矩形参数计算四个顶点
    calculateVerticesFromRect(space) {
      const cx = space.centerX ?? ((space.x ?? 0) + (space.width ?? 0) / 2);
      const cy = space.centerY ?? ((space.y ?? 0) + (space.height ?? 0) / 2);
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
    // 根据 spaceCode 查找原始车位数据
    findSpaceByCode(spaceCode) {
      if (!this.jsonData || !this.jsonData.spaces) return null;
      return this.jsonData.spaces.find(space => space.spaceCode === spaceCode);
    },
    // 触发车辆进入动画
    triggerEntryAnimation(info) {
      if (!info || !info.spaceCode) {
        console.warn('triggerEntryAnimation: 缺少必要信息', info);
        return;
      }
      
      console.log('触发动画，spaceCode:', info.spaceCode);
      
      // 将动画信息存储到映射中
      this.$set(this.entryAnimations, info.spaceCode, {
        plateNum: info.plateNum || '',
        plateType: info.plateType || '02',
        timestamp: Date.now()
      });
    },
    // 判断车位是否正在播放进入动画
    isEntryAnimating(spaceCode) {
      return !!this.entryAnimations[spaceCode];
    },
    // 清除指定车位的动画（需要同时匹配 spaceCode 和 plateNum）
    clearEntryAnimation(spaceCode, plateNum) {
      if (!spaceCode) return;
      
      const animation = this.entryAnimations[spaceCode];
      if (animation) {
        // 如果提供了 plateNum，需要匹配才清除；如果没有提供 plateNum，直接清除
        if (plateNum) {
          if (animation.plateNum === plateNum) {
            this.$delete(this.entryAnimations, spaceCode);
          } else {
            console.log('清除动画失败：车牌号不匹配，spaceCode:', spaceCode, '期望:', plateNum, '实际:', animation.plateNum);
          }
        } else {
          // 没有提供 plateNum，直接清除（兼容旧逻辑）
          this.$delete(this.entryAnimations, spaceCode);
        }
      }
    },
    // 根据车牌号清除动画（查找对应的 spaceCode）
    clearEntryAnimationByPlateNum(plateNum) {
      if (!plateNum) return;
      
      // 查找所有匹配的车位并清除
      const spaceCodesToRemove = [];
      for (const spaceCode in this.entryAnimations) {
        if (this.entryAnimations[spaceCode]?.plateNum === plateNum) {
          spaceCodesToRemove.push(spaceCode);
        }
      }
      
      // 清除所有匹配的动画
      spaceCodesToRemove.forEach(spaceCode => {
        this.$delete(this.entryAnimations, spaceCode);
      });
    },
    // 处理动画结束事件
    handleEntryAnimationEnd() {
      // 动画结束后可以做一些清理工作
      // 不自动移除，保持显示
    },
    // 判断是否显示 label
    shouldShowLabel(box) {
      return box.original && box.original.label && box.original.label.visible === true;
    },
    // 获取 label 文本
    getLabelText(box) {
      if (!box.original || !box.original.label) return '';
      const labelName = box.original.label.name;
      // 如果 name 为空字符串，使用 spaceCode
      return labelName !== undefined && labelName !== '' ? labelName : (box.name || '');
    },
    // 获取 label 样式
    getLabelStyle(box) {
      if (!box.original || !box.original.label) return {};
      
      const { label } = box.original;
      // 减小字体大小，默认从 16 改为 12
      const fontSize = label.fontSize ? Math.max(10, label.fontSize * 0.75) : 12;
      const style = {
        fontSize: `${fontSize}px`,
        color: label.fill || '#000000',
        position: 'absolute',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 10,
      };

      // 根据 position 设置位置
      const position = label.position || 'bottom';
      const margin = label.margin || 0;
      const offsetX = label.offsetX || 0;
      const offsetY = label.offsetY || 0;

      // 计算相对于 box-container 的位置
      // box-container 的尺寸和位置已经在 getBoxStyle 中设置
      let width, height, centerX, centerY;
      
      if (box.xyxyxyxy && box.xyxyxyxy.length >= 4) {
        // 多边形情况：计算边界框
        // box-container 的位置是 left: minX, top: minY
        const xs = box.xyxyxyxy.map(p => p[0]);
        const ys = box.xyxyxyxy.map(p => p[1]);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        width = maxX - minX;
        height = maxY - minY;
        // 相对于容器的中心点
        centerX = width / 2;
        centerY = height / 2;
      } else {
        // 矩形情况：使用 xywhr
        width = box.xywhr.width || 0;
        height = box.xywhr.height || 0;
        centerX = width / 2;
        centerY = height / 2;
      }

      // 根据 position 设置位置（相对于 box-container）
      if (position === 'bottom') {
        style.left = `${centerX + offsetX}px`;
        style.top = `${height + margin + offsetY}px`;
        style.transform = `translateX(-50%)`;
      } else if (position === 'top') {
        style.left = `${centerX + offsetX}px`;
        style.bottom = `${height + margin - offsetY}px`;
        style.transform = `translateX(-50%)`;
      } else if (position === 'left') {
        style.right = `${width + margin - offsetX}px`;
        style.top = `${centerY + offsetY}px`;
        style.transform = `translateY(-50%)`;
      } else if (position === 'right') {
        style.left = `${width + margin + offsetX}px`;
        style.top = `${centerY + offsetY}px`;
        style.transform = `translateY(-50%)`;
      } else if (position === 'center') {
        style.left = `${centerX + offsetX}px`;
        style.top = `${centerY + offsetY}px`;
        style.transform = `translate(-50%, -50%)`;
      }

      // 应用 label 的角度旋转
      if (label.angle !== undefined && label.angle !== 0) {
        const currentTransform = style.transform || '';
        style.transform = `${currentTransform} rotate(${label.angle}deg)`;
        style.transformOrigin = 'center center';
      }

      return style;
    },
  },
};
</script>

<style scoped lang="scss">
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

.space-label {
  position: absolute;
  font-weight: 500;
  user-select: none;
  text-align: center;
}

</style>
