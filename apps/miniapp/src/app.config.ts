import { defineAppConfig } from '@tarojs/taro';

export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/community/community',
    'pages/orders/orders',
    'pages/messages/messages',
    'pages/profile/profile',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'PetCare宠伴',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: '#999',
    selectedColor: '#3CC51F',
    backgroundColor: '#fff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-active.png',
      },
      {
        pagePath: 'pages/community/community',
        text: '社区',
        iconPath: 'assets/tabbar/community.png',
        selectedIconPath: 'assets/tabbar/community-active.png',
      },
      {
        pagePath: 'pages/orders/orders',
        text: '订单',
        iconPath: 'assets/tabbar/order.png',
        selectedIconPath: 'assets/tabbar/order-active.png',
      },
      {
        pagePath: 'pages/messages/messages',
        text: '消息',
        iconPath: 'assets/tabbar/message.png',
        selectedIconPath: 'assets/tabbar/message-active.png',
      },
      {
        pagePath: 'pages/profile/profile',
        text: '我的',
        iconPath: 'assets/tabbar/profile.png',
        selectedIconPath: 'assets/tabbar/profile-active.png',
      },
    ],
  },
});
