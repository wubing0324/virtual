<template>
    <div class="item">{{ source.text }}</div>
  </template>
  
  <script>
    export default {
      name: 'item-component',
      props: {
        index: { // index of current item
          type: Number
        },
        source: { // here is: {uid: 'unique_1', text: 'abc'}
          type: Object,
          default () {
            return {}
          }
        }
      }
    }
  </script>
  <style>
.item {
    height: 48px;
    border: 1px solid #ddd;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>