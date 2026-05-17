const appConfig = {
  cloud: true,
  pages: [
    'pages/news/index',
    'pages/records/index',
    'pages/invite/index',
    'pages/member/index',
    'pages/pay-result/index',
    'pages/webview/index',
  ],
  tabBar: {
    color: '#5f5e5e',
    selectedColor: '#31685c',
    backgroundColor: '#ffffff',
    borderStyle: 'white' as const,
    list: [
      {
        pagePath: 'pages/news/index',
        text: 'AI资讯',
        iconPath: 'assets/tabbar/news.png',
        selectedIconPath: 'assets/tabbar/news-active.png',
      },
      {
        pagePath: 'pages/records/index',
        text: '服务记录',
        iconPath: 'assets/tabbar/records.png',
        selectedIconPath: 'assets/tabbar/records-active.png',
      },
      {
        pagePath: 'pages/invite/index',
        text: '邀请有礼',
        iconPath: 'assets/tabbar/invite.png',
        selectedIconPath: 'assets/tabbar/invite-active.png',
      },
      {
        pagePath: 'pages/member/index',
        text: '会员中心',
        iconPath: 'assets/tabbar/member.png',
        selectedIconPath: 'assets/tabbar/member-active.png',
      },
    ],
  },
  window: {
    navigationBarTitleText: 'AI资讯',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundTextStyle: 'light',
  },
};

export default defineAppConfig(appConfig);
