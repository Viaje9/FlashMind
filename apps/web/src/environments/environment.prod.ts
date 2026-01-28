export const environment = {
  production: true,
  // 使用相對路徑，透過 nginx 代理到 API，避免跨域 cookie 問題
  apiUrl: '/api',
};
