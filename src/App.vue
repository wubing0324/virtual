<template>
  <div id="app">
    <!-- <div class="actions">
      <button class="btn-back" v-for="route in routes" :key="route.path" @click="$router.push(route.path)">
        {{ route.meta.title }}
      </button>
    </div> -->
    <router-view />
  </div>
</template>

<script>
import { routes } from '@/router';
export default {
  name: 'App',
  data() {
    return {
      routes,
    };
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body, html {
  height: 100%;
  overflow: hidden;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
.btn-back {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  backdrop-filter: blur(4px);
  margin-right: 10px
}
.btn-back:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}
.actions{
  height: 40px;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}
</style>
