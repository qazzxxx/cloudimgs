# CloudImgs - 现代图床应用

一个基于 Node.js + React + Ant Design 的现代化图床应用，支持图片上传、管理、预览和 API 接口。

## 功能特性

- 🖼️ **图片上传**: 支持拖拽上传和文件选择，保持原文件名
- 📱 **响应式设计**: 基于 Ant Design 的现代化 UI 界面
- 🔍 **图片管理**: 支持预览、下载、删除、搜索图片
- 📊 **统计信息**: 实时显示存储使用情况和图片统计
- 🔌 **API 接口**: 提供完整的 RESTful API 接口
- 🐳 **Docker 部署**: 支持一键 Docker 部署
- ⚙️ **可配置存储**: 支持自定义图片存储路径
- 📦 **Docker Hub**: 支持发布到 Docker Hub

## 技术栈

### 后端

- Node.js
- Express.js
- Multer (文件上传)
- fs-extra (文件系统操作)

### 前端

- React 18
- Ant Design 5
- Axios (HTTP 客户端)
- Day.js (日期处理)

## 🚀 快速开始

### 使用 Docker Compose（推荐）

1. **克隆项目**

```bash
git clone <repository-url>
cd cloudimgs
```

2. **启动应用**

```bash
# 使用本地构建
docker-compose up -d

# 或使用 Docker Hub 镜像
docker-compose -f docker-compose.prod.yml up -d
```

3. **访问应用**

- 应用地址: http://localhost:3001

### 使用 Docker 直接运行

```bash
# 拉取镜像
docker pull qazzxxx/cloudimgs:latest

# 运行容器
docker run -d \
  --name cloudimgs \
  -p 3001:3001 \
  -v $(pwd)/uploads:/app/uploads \
  qazzxxx/cloudimgs:latest
```

### 环境变量配置

复制 `env.example` 为 `.env` 并修改配置：

```bash
cp env.example .env
```

可配置的环境变量：

- `PORT`: 服务器端口 (默认: 3001)
- `STORAGE_PATH`: 图片存储路径 (默认: ./uploads)
- `NODE_ENV`: 环境模式 (production/development)

## 🐳 Docker 发布

### 发布到 Docker Hub

1. **准备工作**

```bash
# 登录 Docker Hub
docker login

# 构建镜像
docker build -t your-username/cloudimgs:latest .
```

2. **发布镜像**

```bash
# 推送镜像
docker push your-username/cloudimgs:latest

# 发布版本标签
docker build -t your-username/cloudimgs:v1.0.0 .
docker push your-username/cloudimgs:v1.0.0
```

## API 接口

### 上传图片

```http
POST /api/upload
Content-Type: multipart/form-data

参数: image (文件)
```

### 获取图片列表

```http
GET /api/images
```

### 获取随机图片

```http
GET /api/random
```

### 获取统计信息

```http
GET /api/stats
```

### 删除图片

```http
DELETE /api/images/:filename
```

### 获取指定图片

```http
GET /api/images/:filename
```

## 项目结构

```
cloudimgs/
├── server/                 # 后端代码
│   └── index.js           # 服务器主文件
├── client/                # 前端代码
│   ├── public/            # 静态资源
│   ├── src/               # 源代码
│   │   ├── components/    # React组件
│   │   ├── App.js         # 主应用组件
│   │   └── index.js       # 入口文件
│   └── package.json       # 前端依赖
├── uploads/               # 图片存储目录
├── Dockerfile             # Docker配置
├── docker-compose.yml     # Docker Compose配置
├── docker-compose.prod.yml # 生产环境配置
├── .github/workflows/     # GitHub Actions
└── README.md              # 项目说明
```

## 功能模块

### 1. 图片上传

- 支持拖拽上传
- 文件类型验证 (JPG, PNG, GIF, WebP, BMP, SVG)
- 文件大小限制 (10MB)
- 保持原文件名
- 上传进度显示

### 2. 图片管理

- 图片列表展示
- 图片预览
- 图片下载
- 图片删除
- 搜索功能
- 复制图片链接

### 3. 统计信息

- 总图片数量
- 总存储大小
- 存储使用率
- 平均图片大小
- 系统信息展示

## 部署说明

### 生产环境部署

1. **使用 Docker Compose（推荐）**

```bash
# 本地构建
docker-compose up -d

# 或使用 Docker Hub 镜像
docker-compose -f docker-compose.prod.yml up -d
```

2. **使用 Docker 直接运行**

```bash
docker run -d \
  --name cloudimgs \
  -p 3001:3001 \
  -v $(pwd)/uploads:/app/uploads \
  qazzxxx/cloudimgs:latest
```

### 配置说明

- **存储路径**: 通过 `STORAGE_PATH` 环境变量配置
- **端口配置**: 通过 `PORT` 环境变量配置
- **文件限制**: 最大 10MB，支持常见图片格式

## 开发说明

### 添加新功能

1. 在 `server/index.js` 中添加新的 API 路由
2. 在 `client/src/components/` 中创建新的 React 组件
3. 在 `client/src/App.js` 中集成新组件

### 样式定制

- 使用 Ant Design 主题定制
- 在 `client/src/App.js` 中配置 ConfigProvider

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
