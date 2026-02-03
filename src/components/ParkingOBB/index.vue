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
      <ParkingSpaceCanvas
        :image-src="bgImage"
        :data="rawData"
        :show-labels="showLabels"
        @box-hover="handleBoxHover"
      />
      
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
import ParkingSpaceCanvas from './ParkingSpaceCanvas.vue';

export default {
  name: 'ParkingOBB',
  components: {
    ParkingSpaceCanvas,
  },
  data() {
    return {
      rawData: obbData,
      bgImage,
      showLabels: true,
      hoveredBox: null,
      mouseX: 0,
      mouseY: 0,
    };
  },
  computed: {
    // 从新的数据结构中提取 spaces 数组（用于统计）
    allBoxes() {
      if (!this.rawData) return [];
      
      if (this.rawData.spaces && Array.isArray(this.rawData.spaces)) {
        return this.rawData.spaces.map(space => {
          const xyxyxyxy = space.vertices 
            ? space.vertices.map(v => [v.x, v.y])
            : this.calculateVerticesFromRect(space);
          
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
      
      if (Array.isArray(this.rawData)) {
        return this.rawData.flatMap(item => item.boxes || []);
      }
      
      return [];
    },
    totalBoxes() {
      return this.allBoxes.length;
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
  },
  beforeDestroy() {
    window.removeEventListener('mousemove', this.updateMouse);
  },
  methods: {
    handleBoxHover(box) {
      this.hoveredBox = box;
    },
    // 如果没有 vertices，从矩形参数计算四个顶点（用于统计）
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
