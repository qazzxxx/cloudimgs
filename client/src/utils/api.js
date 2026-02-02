import axios from "axios";
import { getPassword, clearPassword } from "./secureStorage";

const isMock = process.env.REACT_APP_MOCK === "true";

// Mock Data Generator
const generateMockImages = () => {
  const images = [];
  const dates = [0, 1, 2]; // Days offset from today (3 days)

  let idCounter = 1;

  dates.forEach((dayOffset) => {
    // Generate 18-22 images per day (around 20)
    const count = Math.floor(Math.random() * 5) + 18;
    const baseTime = Date.now() - dayOffset * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const width = Math.floor(Math.random() * (1600 - 1000) + 1000);
      const height = Math.floor(Math.random() * (1200 - 800) + 800);
      images.push({
        relPath: `mock-image-${idCounter}.jpg`,
        filename: `Mock Image ${idCounter}.jpg`,
        url: `https://picsum.photos/${width}/${height}?random=${idCounter}`,
        size: Math.floor(Math.random() * 5000000),
        uploadTime: baseTime - Math.floor(Math.random() * 1000000), // Slightly vary time within day
        thumbhash: null, // Optional
      });
      idCounter++;
    }
  });

  return images.sort((a, b) => b.uploadTime - a.uploadTime);
};

const mockImages = generateMockImages();

const mockAdapter = async (config) => {
  return new Promise((resolve, reject) => {
    const { url, method, params, data } = config;
    const cleanUrl = url.replace(/^\/api/, "");

    console.log(`[Mock API] ${method.toUpperCase()} ${url}`, params || data);

    setTimeout(() => {
      // Auth Status
      if (cleanUrl === "/auth/status" && method === "get") {
        resolve({
          data: { success: true, data: { enabled: true } },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Auth Verify
      if (cleanUrl === "/auth/login" && method === "post") {
        const body = JSON.parse(data);
        if (body.password === "123456") {
          resolve({
            data: { success: true },
            status: 200,
            statusText: "OK",
            headers: {},
            config,
          });
        } else {
          reject({
            response: {
              status: 401,
              data: { success: false, error: "密码错误" },
            },
          });
        }
        return;
      }

      // Image List
      if (cleanUrl === "/images" && method === "get") {
        const page = params?.page || 1;
        const pageSize = params?.pageSize || 10;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pageData = mockImages.slice(start, end);

        resolve({
          data: {
            success: true,
            data: pageData,
            pagination: {
              current: parseInt(page),
              pageSize: parseInt(pageSize),
              total: mockImages.length,
              totalPages: Math.ceil(mockImages.length / pageSize),
            },
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Image Meta
      if (cleanUrl.startsWith("/images/meta/") && method === "get") {
        resolve({
          data: {
            success: true,
            data: {
              width: 800,
              height: 600,
              space: "sRGB",
              exif: {
                make: "Mock Camera",
                model: "M-1",
                fNumber: 1.8,
                exposureTime: "1/1000",
                iso: 100,
              },
            },
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Directories
      // Directories
      if (cleanUrl.split("?")[0] === "/directories" && method === "get") {
        const previews = mockImages.slice(0, 3).map(img => img.url);
        resolve({
          data: {
            success: true,
            data: [
              { name: "mock-dir-1", path: "mock-dir-1", fullPath: "mock-dir-1", previews, imageCount: 10, mtime: new Date() },
              { name: "mock-dir-2", path: "mock-dir-2", fullPath: "mock-dir-2", previews, imageCount: 5, mtime: new Date() },
            ],
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Create Directory
      if (cleanUrl.split("?")[0] === "/directories" && method === "post") {
        resolve({
          data: { success: true, message: "Directory created (mock)" },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Share Generate
      if (cleanUrl === "/share/generate" && method === "post") {
        resolve({
          data: { success: true, token: "mock-token-" + Date.now() },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Share Access
      if (cleanUrl.startsWith("/share/access") && method === "get") {
        resolve({
          data: {
            success: true,
            data: mockImages.slice(0, 10),
            dirName: "Mock Share Album"
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Delete Image
      if (cleanUrl.startsWith("/images/") && method === "delete") {
        resolve({
          data: { success: true },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Update Image (Rename/Move)
      if (cleanUrl.startsWith("/images/") && method === "put") {
        const body = JSON.parse(data);
        const originalRelPath = decodeURIComponent(cleanUrl.split("/images/")[1]);
        const newName = body.newName;
        // const newDir = body.newDir;

        let updatedRelPath = originalRelPath;
        let updatedFilename = originalRelPath.split("/").pop();

        if (newName) {
          updatedFilename = newName;
          const dir = originalRelPath.includes("/") ? originalRelPath.substring(0, originalRelPath.lastIndexOf("/")) : "";
          updatedRelPath = dir ? `${dir}/${newName}` : newName;
        }

        resolve({
          data: {
            success: true,
            data: {
              relPath: updatedRelPath,
              filename: updatedFilename,
              url: `https://picsum.photos/800/600?random=${Math.random()}`, // Just return a valid obj
              size: 1024,
              uploadTime: Date.now(),
              thumbhash: null
            }
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Upload
      if (cleanUrl === "/upload" && method === "post") {
        resolve({
          data: { success: true, data: [] }, // Return empty or fake
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // System Health
      if (cleanUrl === "/health" && method === "get") {
        resolve({
          data: { status: "ok" },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // System Config
      if (cleanUrl === "/config" && method === "get") {
        resolve({
          data: {
            success: true,
            data: {
              upload: { maxFileSize: 104857600, allowedExtensions: [".jpg", ".png", ".gif", ".mp4"] },
              storage: { filename: { keepOriginalName: true } },
              magicSearch: { enabled: true }
            }
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Stats Traffic
      if (cleanUrl.startsWith("/stats/traffic") && method === "get") {
        const days = params?.days || 30;
        const data = [];
        for (let i = 0; i < days; i++) {
          data.push({
            date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
            views: Math.floor(Math.random() * 1000),
            traffic: Math.floor(Math.random() * 50000000)
          });
        }
        resolve({
          data: { success: true, data: data.reverse() },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Stats Top
      if (cleanUrl.startsWith("/stats/top") && method === "get") {
        resolve({
          data: {
            success: true,
            data: mockImages.slice(0, 10).map(img => ({
              ...img,
              views: Math.floor(Math.random() * 5000)
            }))
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Semantic Search
      if (cleanUrl === "/search/semantic" && method === "post") {
        resolve({
          data: {
            success: true,
            data: mockImages.slice(0, 8).map(img => ({
              ...img,
              score: Math.random()
            }))
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Batch Move
      if (cleanUrl === "/batch/move" && method === "post") {
        resolve({
          data: { success: true, successCount: 1, failCount: 0 },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        });
        return;
      }

      // Default Success for others
      resolve({
        data: { success: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      });
    }, 300); // Simulate latency
  });
};

// 创建axios实例
const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
  adapter: isMock ? mockAdapter : undefined,
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
      // Don't reload, let the app handle the auth state change
      // window.location.reload(); 
    }
    return Promise.reject(error);
  }
);

export default api;
