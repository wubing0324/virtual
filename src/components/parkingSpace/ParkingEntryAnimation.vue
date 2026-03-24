<template>
  <div
    class="entry-animation-label"
    :class="`color-${plateType}`"
    :style="animationStyle"
    @animationend="handleAnimationEnd"
  >
    <!-- 自定义样式 slot，如果没有提供 slot 则显示默认内容 -->
    <slot :space-code="spaceCode" :plate-num="plateNum" :plate-type="plateType" :is-vertical="isVertical">
      <!-- 默认内容（如果 slot 为空时显示） -->
      <div class="animation-content animation-content-vertical" v-if="isVertical">
        <span class="plate-num-display">{{ plateNum.slice(2) }}</span>
        <div class="space-code-badge">
          <span class="space-code">{{ spaceCode }}</span>
          <span class="special-label">{{ plateNum.slice(0, 2) }}</span>
        </div>
      </div>
      <div class="animation-content" v-else>
        <div class="space-code-badge">
          <span class="space-code">{{ spaceCode }}</span>
          <span class="special-label">{{ plateNum.slice(0, 2) }}</span>
        </div>
        <span class="plate-num-display">{{ plateNum.slice(2) }}</span>
      </div>
    </slot>
  </div>
</template>

<script>
export default {
  name: 'ParkingEntryAnimation',
  props: {
    // 车位 box 对象，包含位置、角度等信息
    box: {
      type: Object,
      required: true,
    },
    // 车辆进入信息 { plateNum, plateType, timestamp }
    entryInfo: {
      type: Object,
      default: null,
    },
  },
  computed: {
    // 车位编号
    spaceCode() {
      return this.box.name || '';
    },
    // 车牌号
    plateNum() {
      return this.entryInfo?.plateNum || '';
    },
    // 车牌类型（02: 蓝牌, 52: 新能源）
    plateType() {
      return this.entryInfo?.plateType || '02';
    },
    // 动画容器的样式（旋转角度等）
    animationStyle() {
      // 通过旋转角度来控制方向
      // 如果 box-container 已经旋转了（没有 xyxyxyxy），动画标签需要抵消旋转保持水平
      // 如果 box-container 没有旋转（有 xyxyxyxy），动画标签需要旋转来匹配车位方向
      const angle = this.box.xywhr?.angle_deg || this.box.angle_deg || 0;
      
      // 基础样式对象
      const baseStyle = {
        transformOrigin: 'center center',
      };

      // 判断是否为垂直方向（90度或-90度）,在样式立定义了，这里不用加了
      // const isVertical = angle === 90 || angle === -90;
      // 如果是垂直方向，添加文字竖排样式
      // if (isVertical) {
      //   baseStyle.textOrientation = 'upright';
      //   baseStyle.writingMode = 'vertical-rl';
      // }
      
      // 如果 box-container 有旋转（没有 xyxyxyxy），需要抵消旋转
      if (!this.box.xyxyxyxy || this.box.xyxyxyxy.length < 4) {
        return {
          ...baseStyle,
          transform: `rotate(${-angle}deg)`, // 抵消父容器的旋转，保持文字水平
        };
      }
      
      // 如果 box-container 没有旋转（有 xyxyxyxy），应用旋转来匹配车位方向
      return {
        ...baseStyle,
        transform: `rotate(${angle}deg)`,
      };
    },
    // 车位是不是垂直的矩形
    isVertical() {
      return this.box.xywhr?.angle_deg === 90 || this.box.xywhr?.angle_deg === -90;
    },
  },
  methods: {
    handleAnimationEnd() {
      this.$emit('animationend');
    },
  },
  mounted() {
    console.log('box = ', this.box);
  },
};
</script>

<style scoped lang="scss">
.entry-animation-label {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 99;
  transform-origin: center;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  padding: 2px 3px;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  /* GPU 加速优化 */
  will-change: transform, opacity;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  perspective: 1000px;
  animation-fill-mode: forwards;
  display: flex;
  
  .animation-content {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    font-weight: 700;
  }
  .animation-content-vertical {
    text-orientation: upright;
    writing-mode: vertical-rl;
    .plate-num-display{
      width: 50%;
      letter-spacing: 0;
      line-height: 1;
      font-size: 18px;
    }
    .space-code-badge{
      padding: 2px 0 0 2px;
      .space-code{
        font-size: 16px;
      }
      .special-label{
        font-size: 18px;
      }
    }
  }
  .space-code-badge {
    font-weight: 700;
    font-size: 20px;
    padding: 1px 2px;
    border-radius: 1px;
    display: inline-block;
    white-space: nowrap;
    flex-shrink: 0;
    line-height: 1;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    .space-code {
      font-weight: 700;
      font-size: 20px;
      padding: 1px 2px;
      border-radius: 1px;
      display: inline-block;
      white-space: nowrap;
      flex-shrink: 0;
      line-height: 1;
      background: #1e293b;
      color: #f9f718;
    }
    .special-label {
      font-weight: 700;
      font-size: 20px;
      padding: 1px 2px;
      border-radius: 1px;
      display: inline-block;
      white-space: nowrap;
      flex-shrink: 0;
      line-height: 1;
      text-align: right;
    }
  }
  
  .plate-num-display {
    font-weight: 700;
    font-size: 20px;
    text-align: center;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
    line-height: 1.2;
    letter-spacing: 3px;
  }
  
  // 绿色样式（新能源，plateType: 52）
  &.color-52 {
    animation: showNumColorGreen 3s ease-out 1 forwards;
    color: #000000;
    border: 1px solid #0a428f;
    background: linear-gradient(180deg, #a8e6a8 0%, #4ade80 54.69%, #16a34a 100%);
    .plate-num-display {
      color: #000000;
    }
  }
  
  // 蓝色样式（蓝牌，plateType: 02）
  &.color-02 {
    animation: showNumColorBlue 3s ease-out 1 forwards;
    color: #ffffff;
    border: 1px solid #1e40af;
    background: #3b82f6;
    .plate-num-display {
      color: #ffffff;
    }
  }
  
  // 其他车牌类型使用默认蓝色样式
  &:not(.color-52):not(.color-02) {
    animation: showNumColorBlue 3s ease-out 1 forwards;
    color: #ffffff;
    border: 1px solid #1e40af;
    background: #3b82f6;
    .plate-num-display {
      color: #ffffff;
    }
  }
}

/* 绿色样式动画（新能源，plateType: 52） */
@keyframes showNumColorGreen {
  0% {
    transform: translate3d(-27.5px, -30px, 0) scale(2.0);
    opacity: 0.8;
  }
  10% {
    transform: translate3d(-22.5px, -25px, 0) scale(1.82);
    opacity: 0.9;
  }
  20% {
    transform: translate3d(-17.5px, -20px, 0) scale(1.64);
    opacity: 1;
  }
  30% {
    transform: translate3d(-12.5px, -15px, 0) scale(1.45);
    opacity: 1;
  }
  60% {
    transform: translate3d(-5px, -3px, 0) scale(1.18);
    opacity: 1;
  }
  90% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
  }
}

/* 蓝色样式动画（蓝牌，plateType: 02） */
@keyframes showNumColorBlue {
  0% {
    transform: translate3d(-27.5px, -30px, 0) scale(2.0);
    opacity: 0.8;
  }
  10% {
    transform: translate3d(-22.5px, -25px, 0) scale(1.82);
    opacity: 0.9;
  }
  20% {
    transform: translate3d(-17.5px, -20px, 0) scale(1.64);
    opacity: 1;
  }
  30% {
    transform: translate3d(-12.5px, -15px, 0) scale(1.45);
    opacity: 1;
  }
  60% {
    transform: translate3d(-5px, -3px, 0) scale(1.18);
    opacity: 1;
  }
  90% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
  }
}
</style>
