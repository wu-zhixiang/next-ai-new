const appConfig = {
  cloud: true,
  pages: [
    'pages/home/index',
    'pages/news/index',
    'pages/news-detail/index',
    'pages/tools/index',
    'pages/tool-intro/index',
    'pages/tool-detail/index',
    'pages/tool-history/index',
    'pages/records/index',
    'pages/invite/index',
    'pages/member/index',
    'pages/active-services/index',
    'pages/invoice/index',
    'pages/pay-result/index',
    'pages/webview/index',
  ],
  tabBar: {
    color: '#7A7A7A',
    selectedColor: '#D97757',
    backgroundColor: '#F7F5F2',
    borderStyle: 'black' as const,
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/tabbar/news.png',
        selectedIconPath: 'assets/tabbar/news-active.png',
      },
      {
        pagePath: 'pages/tools/index',
        text: 'AI工具',
        iconPath: 'assets/tabbar/tools.png',
        selectedIconPath: 'assets/tabbar/tools-active.png',
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
    navigationBarTitleText: '首页',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundTextStyle: 'light',
  },
};

export default defineAppConfig(appConfig);
