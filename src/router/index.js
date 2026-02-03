import Vue from 'vue';
import VueRouter from 'vue-router';
import ImageUpload from '@/components/ImageUpload.vue';
import EditArea from '@/components/EditArea/index.vue';

Vue.use(VueRouter);

export const routes = [
  {
    path: '/',
    name: 'ImageUpload',
    component: ImageUpload,
    meta: {
      title: '上传图片',
    },
  },
  {
    path: '/edit',
    name: 'EditArea',
    component: EditArea,
    meta: {
      title: '编辑区域',
    },
  },
  {
    path: '/parking-draw',
    name: 'ParkingDraw',
    component: () => import('@/components/ParkingDraw/index.vue'),
    meta: {
      title: 'svg绘制',
    },
  },
  {
    path: '/parking-dom',
    name: 'ParkingDom',
    component: () => import('@/components/ParkingDom/index.vue'),
    meta: {
      title: 'dom绘制',
    },
  },
  {
    path: '/parking-json',
    name: 'ParkingJson',
    component: () => import('@/components/ParkingJson/index.vue'),
    meta: {
      title: 'json绘制',
    },
  },
  {
    path: '/parking-json-2',
    name: 'ParkingJson2',
    component: () => import('@/components/ParkingJson2/index.vue'),
    meta: {
      title: 'json2绘制',
    },
  },
  {
    path: '/parking-obb',
    name: 'ParkingOBB',
    component: () => import('@/components/ParkingOBB/index.vue'),
    meta: {
      title: 'OBB结果',
    },
  },
  {
    path: '/ParkingSvg',
    name: 'ParkingSvg',
    component: () => import('@/components/ParkingSvg/index.vue'),
    meta: {
      title: 'OBB结果',
    },
  },
];

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes,
});

export default router;
