<template>
  <div class="parking-obb-container">
    <div class="header">
      <h2>OBB Result Visualization</h2>
      <div class="controls">
        <label>
          <input type="checkbox" v-model="showLabels"> Show Labels
        </label>
        <div class="stats">
          Total Boxes: {{ totalBoxes }}
        </div>
      </div>
    </div>
    
    <div class="canvas-wrapper" ref="wrapper">
      <svg 
        v-if="viewBox"
        :viewBox="viewBox" 
        class="obb-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <!-- Background/Border for context -->
        <!-- Background Image -->
        <image 
          v-if="bgImage"
          :href="bgImage"
          x="0" 
          y="0" 
          :width="canvasWidth" 
          :height="canvasHeight"
        />
        <rect 
          v-else
          :width="canvasWidth" 
          :height="canvasHeight" 
          fill="#f8f9fa" 
          stroke="#ddd" 
          stroke-width="2"
        />

        <g v-for="(box, index) in allBoxes" :key="index" class="box-group">
          <!-- Main Polygon -->
          <polygon
            :points="getPoints(box.xyxyxyxy)"
            class="box-polygon"
            :class="{ 'high-conf': box.confidence > 0.8 }"
            @mouseenter="hoveredBox = box"
            @mouseleave="hoveredBox = null"
          />
          
          <!-- Direction Indicator (First two points usually verify orientation) -->
          <line
            :x1="box.xyxyxyxy[0][0]"
            :y1="box.xyxyxyxy[0][1]"
            :x2="box.xyxyxyxy[1][0]"
            :y2="box.xyxyxyxy[1][1]"
            stroke="red"
            stroke-width="2"
            v-if="hoveredBox === box"
          />

          <!-- Label -->
          <text
            v-if="showLabels || hoveredBox === box"
            :x="box.xywhr.center_x"
            :y="box.xywhr.center_y"
            class="box-label"
            text-anchor="middle"
            dominant-baseline="middle"
            :transform="`rotate(${box.xywhr.angle_deg}, ${box.xywhr.center_x}, ${box.xywhr.center_y})`"
          >
            {{ box.name }}
          </text>
        </g>
      </svg>
      
      <!-- Floating Info Card -->
      <div v-if="hoveredBox" class="info-card" :style="infoCardStyle">
        <h4>{{ hoveredBox.name }}</h4>
        <p><strong>Conf:</strong> {{ (hoveredBox.confidence * 100).toFixed(1) }}%</p>
        <p><strong>Angle:</strong> {{ hoveredBox.angle_deg.toFixed(2) }}°</p>
        <p><strong>Center:</strong> ({{ hoveredBox.xywhr.center_x.toFixed(0) }}, {{ hoveredBox.xywhr.center_y.toFixed(0) }})</p>
        <p><strong>Size:</strong> {{ hoveredBox.xywhr.width.toFixed(0) }} x {{ hoveredBox.xywhr.height.toFixed(0) }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import obbData from '@/assets/const/parking-spaces.json';
import bgImage from '@/assets/white.png';

export default {
  name: 'ParkingOBB',
  data() {
    return {
      rawData: obbData,
      bgImage,
      imgWidth: 0,
      imgHeight: 0,
      showLabels: true,
      hoveredBox: null,
      wrapperRect: null,
      mouseX: 0,
      mouseY: 0,
    };
  },
  computed: {
    // 从新的数据结构中提取 spaces 数组
    allBoxes() {
      if (!this.rawData) return [];
      
      // 新格式：{ metadata, recognitionConfig, spaces: [...] }
      if (this.rawData.spaces && Array.isArray(this.rawData.spaces)) {
        return this.rawData.spaces.map(space => {
          // 转换数据结构以适配组件
          // 将 vertices 转换为 xyxyxyxy 格式
          const xyxyxyxy = space.vertices 
            ? space.vertices.map(v => [v.x, v.y])
            : this.calculateVerticesFromRect(space);
          
          // 计算角度（弧度）
          const angleRad = (space.angle || 0) * Math.PI / 180;
          
          return {
            id: space.id,
            name: space.spaceCode || space.number || `Space ${space.id}`,
            confidence: 1.0, // 新格式没有置信度，设为1.0
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
            // 保留原始数据
            original: space,
          };
        });
      }
      
      // 兼容旧格式：数组格式
      if (Array.isArray(this.rawData)) {
        return this.rawData.flatMap(item => item.boxes || []);
      }
      
      return [];
    },
    totalBoxes() {
      return this.allBoxes.length;
    },
    // 从 metadata 获取图片尺寸
    imageSize() {
      if (this.rawData && this.rawData.metadata && this.rawData.metadata.imageSize) {
        return this.rawData.metadata.imageSize;
      }
      return { width: 0, height: 0 };
    },
    // Calculate bounding box of all polygons to set viewBox
    bounds() {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      this.allBoxes.forEach(box => {
        if (box.xyxyxyxy && Array.isArray(box.xyxyxyxy)) {
          box.xyxyxyxy.forEach(point => {
            const [x, y] = point;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          });
        }
      });

      // Add some padding
      const padding = 50;
      return {
        minX: Math.max(0, minX - padding),
        minY: Math.max(0, minY - padding),
        maxX: maxX + padding,
        maxY: maxY + padding
      };
    },
    canvasWidth() {
      // 优先使用 metadata 中的图片尺寸
      if (this.imageSize.width > 0) {
        return this.imageSize.width;
      }
      if (this.imgWidth > 0) {
        return this.imgWidth;
      }
      return this.bounds.maxX;
    },
    canvasHeight() {
      // 优先使用 metadata 中的图片尺寸
      if (this.imageSize.height > 0) {
        return this.imageSize.height;
      }
      if (this.imgHeight > 0) {
        return this.imgHeight;
      }
      return this.bounds.maxY;
    },
    viewBox() {
      // 优先使用 metadata 中的图片尺寸
      if (this.imageSize.width > 0 && this.imageSize.height > 0) {
        return `0 0 ${this.imageSize.width} ${this.imageSize.height}`;
      }
      if (this.imgWidth > 0 && this.imgHeight > 0) {
        return `0 0 ${this.imgWidth} ${this.imgHeight}`;
      }
      if (this.totalBoxes === 0) return '0 0 1000 1000';
      const { minX, minY, maxX, maxY } = this.bounds;
      return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    },
    infoCardStyle() {
      // Position tooltip near mouse
      return {
        top: `${this.mouseY + 20}px`,
        left: `${this.mouseX + 20}px`
      };
    }
  },
  mounted() {
    window.addEventListener('mousemove', this.updateMouse);
    this.loadImage();
  },
  beforeDestroy() {
    window.removeEventListener('mousemove', this.updateMouse);
  },
  methods: {
    loadImage() {
        const img = new Image();
        img.src = this.bgImage;
        img.onload = () => {
            this.imgWidth = img.naturalWidth;
            this.imgHeight = img.naturalHeight;
        };
    },
    getPoints(pointsArray) {
      if (!pointsArray || !Array.isArray(pointsArray)) return '';
      return pointsArray.map(p => {
        // 处理数组格式 [x, y] 或对象格式 {x, y}
        if (Array.isArray(p)) {
          return p.join(',');
        }
        if (p && typeof p === 'object' && p.x !== undefined && p.y !== undefined) {
          return `${p.x},${p.y}`;
        }
        return '';
      }).filter(p => p).join(' ');
    },
    // 如果没有 vertices，从矩形参数计算四个顶点
    calculateVerticesFromRect(space) {
      const cx = space.centerX || space.x;
      const cy = space.centerY || space.y;
      const w = space.width || 0;
      const h = space.height || 0;
      const angle = (space.angle || 0) * Math.PI / 180;
      
      // 计算矩形的四个角点（相对于中心）
      const halfW = w / 2;
      const halfH = h / 2;
      const corners = [
        [-halfW, -halfH],
        [halfW, -halfH],
        [halfW, halfH],
        [-halfW, halfH]
      ];
      
      // 旋转并平移
      return corners.map(([x, y]) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;
        return [cx + rotatedX, cy + rotatedY];
      });
    },
    updateMouse(e) {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    }
  }
};
</script>

<style scoped>
.parking-obb-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: blue;
  font-family: 'Inter', sans-serif;
}

.header {
  padding: 16px 24px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}

.header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
}

.controls {
  display: flex;
  gap: 20px;
  align-items: center;
}

.stats {
  font-size: 0.9rem;
  color: #666;
  background: #f5f5f5;
  padding: 4px 12px;
  border-radius: 12px;
}

.canvas-wrapper {
  flex: 1;
  overflow: auto;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.obb-svg {
  max-width: 100%;
  max-height: 100%;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  background: white;
  border-radius: 8px;
}

.box-polygon {
  fill: rgba(33, 150, 243, 0.15);
  stroke: #2196F3;
  stroke-width: 2;
  transition: all 0.2s ease;
  cursor: pointer;
}

.box-polygon:hover {
  fill: rgba(33, 150, 243, 0.4);
  stroke-width: 3;
}

.box-polygon.high-conf {
  stroke: #00C853; /* Green for high confidence */
  fill: rgba(0, 200, 83, 0.15);
}

.box-polygon.high-conf:hover {
  fill: rgba(0, 200, 83, 0.4);
}

.box-label {
  font-size: 14px;
  fill: #333;
  font-weight: 500;
  pointer-events: none;
  text-shadow: 0 1px 2px white;
}

.info-card {
  position: fixed;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 12px;
  border-radius: 8px;
  pointer-events: none;
  font-size: 0.85rem;
  z-index: 100;
  backdrop-filter: blur(4px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.info-card h4 {
  margin: 0 0 8px 0;
  color: #4fc3f7;
}

.info-card p {
  margin: 4px 0;
}
</style>
