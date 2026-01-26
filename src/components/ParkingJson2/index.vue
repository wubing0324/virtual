<template>
  <div class="parking-json2-page">
    <div class="controls">
      <button @click="$router.push('/')">返回首页</button>
      <div class="info">
        当前使用数据源: src/assets/const/aaaa停车场222.json <br/>
        (该文件仅包含属性无坐标，以下为模拟网格排列展示)
      </div>
      <div class="stats">
        车位数量: {{ parkingSpaces.length }}
      </div>
    </div>

    <div class="viewport">
      <div class="canvas-container" :style="containerStyle">
        <!-- 模拟网格绘制层 -->
        <div class="parking-grid">
          <div 
            v-for="space in parkingSpaces" 
            :key="space.id"
            class="parking-cell"
            :class="space.type"
            :style="getSpaceStyle(space)"
            @click="toggleSpaceType(space)"
          >
            <div class="plate-number">{{ space.number }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 引入仅含属性的 JSON 文件
import rawData from '@/assets/const/aaaa停车场222.json';

export default {
  name: 'ParkingJson2',
  data() {
    return {
      parkingSpaces: [],
      // 虚拟画布尺寸
      mapWidth: 1000, 
      mapHeight: 800,
      zoom: 1,
    };
  },
  computed: {
    containerStyle() {
      return {
        width: `${this.mapWidth}px`,
        height: `${this.mapHeight}px`,
        position: 'relative',
        background: '#fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      };
    },
  },
  mounted() {
    this.processData();
  },
  methods: {
    processData() {
      // 1. 过滤车位数据
      // 假设 layer 为 'A-PKNG-TSRP' 的是车位
      const parkingItems = rawData.filter(item => item.layer === 'A-PKNG-TSRP');
      
      // 2. 生成模拟坐标 (网格布局)
      const cols = 20; // 每行20个
      const cellW = 40;
      const cellH = 60;
      const gap = 10;
      const startX = 20;
      const startY = 20;

      this.parkingSpaces = parkingItems.map((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);

        return {
          id: item.handle || index,
          number: `No.${index + 1}`,
          // 模拟坐标
          x: startX + col * (cellW + gap),
          y: startY + row * (cellH + gap),
          w: cellW,
          h: cellH,
          // 随机类型
          type: Math.random() > 0.7 ? 'green-plate' : 'blue-plate',
          original: item
        };
      });
      
      // 动态调整画布高度以适应内容
      const rows = Math.ceil(parkingItems.length / cols);
      this.mapHeight = Math.max(800, startY + rows * (cellH + gap) + 50);
    },
    getSpaceStyle(space) {
      return {
        left: `${space.x}px`,
        top: `${space.y}px`,
        width: `${space.w}px`,
        height: `${space.h}px`,
      };
    },
    toggleSpaceType(space) {
      space.type = space.type === 'blue-plate' ? 'green-plate' : 'blue-plate';
    }
  }
};
</script>

<style scoped>
.parking-json2-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f0f2f5;
  overflow: hidden;
}

.controls {
  padding: 12px 24px;
  background: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  z-index: 10;
}

.controls .info {
  font-size: 12px;
  color: #f5222d;
  background: #fff1f0;
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid #ffa39e;
  text-align: center;
}

.viewport {
  flex: 1;
  overflow: auto;
  padding: 20px;
  display: flex;
  justify-content: center;
}

.parking-cell {
  position: absolute;
  border: 1px solid #ccc;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
}

.parking-cell:hover {
  transform: scale(1.1);
  z-index: 10;
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.plate-number {
  font-size: 10px;
  font-weight: bold;
}

/* 蓝色车牌 */
.parking-cell.blue-plate {
  border-color: #1890ff;
  background: rgba(24, 144, 255, 0.05);
}
.parking-cell.blue-plate .plate-number {
  color: #1890ff;
}

/* 绿色车牌 */
.parking-cell.green-plate {
  border-color: #52c41a;
  background: rgba(82, 196, 26, 0.05);
}
.parking-cell.green-plate .plate-number {
  color: #52c41a;
}
</style>
