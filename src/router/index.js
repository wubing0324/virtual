import Vue from 'vue';
import VueRouter from 'vue-router';
import ImageUpload from '@/components/ImageUpload.vue';
import EditArea from '@/components/EditArea/index.vue';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'ImageUpload',
    component: ImageUpload,
  },
  {
    path: '/edit',
    name: 'EditArea',
    component: EditArea,
  },
  {
    path: '/parking-draw',
    name: 'ParkingDraw',
    component: () => import('@/components/ParkingDraw/index.vue'),
  },
  {
    path: '/parking-dom',
    name: 'ParkingDom',
    component: () => import('@/components/ParkingDom/index.vue'),
  },
];

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes,
});

export default router;
