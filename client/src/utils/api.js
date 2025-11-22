import axios from "axios";
import { getPassword, clearPassword } from "./secureStorage";

// 创建axios实例
const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

// 请求拦截器 - 添加密码到请求头
api.interceptors.request.use(
  (config) => {
    const password = getPassword();
    if (password) {
      config.headers["X-Access-Password"] = password;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理密码错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      clearPassword();
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
