<template>
  <div class="parking-space-canvas-container">
    <ParkingSpaceCanvas
      v-if="imageSrc"
      :entry-info="currentEntryInfo"
      :clear-info="currentClearInfo"
      :image-src="imageSrc"
      :json-data="obbData"
    />
  </div>
</template>

<script>
import ParkingSpaceCanvas from './ParkingSpaceCanvas.vue'
import { mapState } from 'vuex'
// import { getParkingSpaceList } from '@/api/homepage'
import defaultObbData from '@/assets/const/parking-spaces.json'

export default {
  name: 'ParkingSpaceCanvasContainer',
  components: {
    ParkingSpaceCanvas
  },
  props: {
    /** 与导出 JSON 结构一致；传入时优先于默认静态数据 */
    jsonData: {
      type: Object,
      default: null,
    },
    /** 为 true 时不监听 WebSocket、不跑初始化动画，用于编辑区预览 */
    previewMode: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    ...mapState('webSocket', [
      'NETCAR_PARK_SPACE_INFO',
      'NETCAR_ENTER_RECORD_INFO'
    ]),
    obbData() {
      return this.jsonData || defaultObbData
    },
    imageSrc() {
      const m = this.obbData && this.obbData.metadata
      return (m && m.imageUrl) || ''
    },
  },
  data() {
    return {
      currentEntryInfo: null, // 当前需要触发动画的车辆信息
      currentClearInfo: null, // 当前需要清除动画的信息
    }
  },
  mounted() {
    this.initAnimations()
  },
  watch: {
    // 车辆进入或离开车位
    NETCAR_PARK_SPACE_INFO(val) {
      if (this.previewMode) return
      if (!val || !val.spaceCode) return
      
      const info = val
      // spaceStatus == 0: 离开车位；spaceStatus == 1: 进入车位
      if (info.spaceStatus === 0) {
        // 车辆离开车位 - 清除动画
        this.currentClearInfo = { spaceCode: info.spaceCode, plateNum: info.plateNum }
      } else {
        // 车辆进入车位 - 触发进入动画
        this.triggerEntryAnimation(info)
      }
    },
    // 车辆离场时清除动画
    NETCAR_ENTER_RECORD_INFO(val) {
      if (this.previewMode) return
      if (!val || val.dataType == 1) return // 只处理离场
      
      const info = val
      // 清除动画 - 根据车牌号清除所有相关动画
      this.currentClearInfo = { plateNum: info.plateNum }
    }
  },
  methods: {
    // 初始化动画（获取已在车位上的车辆并触发动画）
    async initAnimations() {
      try {
        // const res = await getParkingSpaceList({ parkCode: '1' })
        const res = this.obbData.spaces
        if (res && res.length > 0) {
          // 延迟触发动画，避免同时触发多个动画造成性能问题
          res.forEach((item, index) => {
            item.plateType = Math.random() > 0.5 ? '52' : '02'
            item.plateNum = '浙A12345' + index
            item.timestamp = Date.now()
            if (item.spaceCode) {
              setTimeout(() => {
                this.triggerEntryAnimation(item)
              }, index * 100) // 每个动画间隔100ms
            }
          })
        }
      } catch (error) {
        console.error('初始化动画失败:', error)
      }
    },
    // 触发进入车位动画
    triggerEntryAnimation(info) {
      this.currentEntryInfo = { ...info }
    }
  }
}
</script>

<style scoped lang="scss">
.parking-space-canvas-container {
  width: 1460px;
  height: 968px;
}
</style>
