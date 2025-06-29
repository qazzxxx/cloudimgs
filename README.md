# CloudImgs - 简单、方便的开源图床项目，支持 NAS 部署

一个简单、方便的开源图床项目，一键 NAS 部署，支持图片上传、管理、预览和分享。

## 功能特性

### 🚀 核心功能

- **图片上传**: 支持拖拽上传，多种图片格式
- **图片管理**: 浏览、预览、下载、删除图片
- **图片分享**: 一键复制图片链接
- **统计信息**: 实时显示存储使用情况

### 📁 子目录管理

- **智能目录选择**: 可选择现有目录或输入新目录
- **目录信息展示**: 在图片管理页面显示当前目录信息
- **目录统计**: 支持按目录统计图片数量和存储大小

### 🔧 SVG 工具 (新增)

- **SVG 转 PNG**: 输入 SVG 代码，实时转换为 PNG 图片
- **在线预览**: 转换后立即预览 PNG 效果
- **一键上传**: 转换完成后直接上传到图床
- **批量下载**: 支持下载转换后的 PNG 图片
- **示例代码**: 提供常用 SVG 示例代码
- **自定义文件名**: 支持自定义上传和下载的文件名
- **自动生成文件名**: 基于时间戳自动生成文件名

### 🗜️ 图片压缩工具 (新增)

- **Canvas 压缩**: 基于 Canvas API 进行高质量图片压缩
- **尺寸调整**: 支持设置压缩后的宽度和高度
- **宽高比锁定**: 自动保持原始图片的宽高比例
- **质量调节**: 1-100% 可调节压缩质量
- **实时预览**: 压缩后立即预览效果
- **压缩信息**: 显示原始大小、压缩后大小和压缩率
- **一键上传**: 压缩完成后直接上传到图床
- **本地下载**: 支持下载压缩后的图片
- **智能默认**: 根据原始图片自动计算合适的压缩尺寸

### 🌓 主题切换功能 (新增)

- **多主题支持**: 支持浅色主题和暗色主题
- **自动模式**: 根据系统时间自动切换主题（6:00-18:00 浅色，18:00-6:00 暗色）
- **手动切换**: 支持手动选择浅色、暗色或自动模式
- **主题持久化**: 主题设置自动保存到本地存储
- **实时切换**: 主题切换立即生效，无需刷新页面
- **全面适配**: 所有页面和组件都完美适配两种主题
- **优雅动画**: 主题切换时有平滑的过渡效果

### 📱 移动端适配 (新增)

- **响应式布局**: 基于 Ant Design Grid 系统的完美响应式设计
- **移动端导航**: 移动端使用抽屉式菜单，提供更好的触摸体验
- **自适应布局**: 根据屏幕尺寸自动调整布局和组件大小
- **触摸优化**: 按钮和交互元素针对移动端触摸操作进行优化
- **图片管理**: 移动端图片网格自动调整为单列布局
- **API 文档**: 移动端代码示例和文档自动适配小屏幕
- **主题适配**: 移动端完美支持浅色和暗色主题切换

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
```

### 启动服务

```bash
# 启动后端服务 (端口 3001)
node server/index.js

# 启动前端开发服务器 (端口 3000)
cd client
npm start
```

### 快速部署 - docker-compose.yml

```yaml
version: "3.8"

services:
  cloudimgs:
    image: qazzxxx/cloudimgs:latest
    ports:
      - "3001:3001"
    volumes:
      - ./uploads:/app/uploads:rw # 上传目录配置，明确读写权限
    restart: unless-stopped
    container_name: cloudimgs-app
    # 使用 root 用户运行以解决权限问题
    user: "root"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - STORAGE_PATH=/app/uploads
```

### 文件格式支持

- **默认格式**: JPG, PNG, GIF, WebP, BMP, SVG
- **可配置**: 通过 `ALLOWED_EXTENSIONS` 环境变量自定义
- **文件大小**: 默认最大 10MB，可通过 `MAX_FILE_SIZE` 配置

## API 接口

### 📤 图片上传

```
POST /api/upload
```

**参数说明：**

- `image` (必需): 图片文件，支持 multipart/form-data
- `dir` (可选): 子目录路径，如 "2024/06/10" 或 "相册/家庭"

**支持格式：** JPG, PNG, GIF, WebP, BMP, SVG  
**文件大小限制：** 最大 10MB

**curl 示例：**

```bash
# 上传到根目录
curl -X POST http://localhost:3001/api/upload \
  -F "image=@/path/to/your/image.jpg"

# 上传到指定子目录
curl -X POST "http://localhost:3001/api/upload?dir=2024/06/10" \
  -F "image=@/path/to/your/image.jpg"

# 上传中文文件名图片
curl -X POST "http://localhost:3001/api/upload?dir=相册/家庭" \
  -F "image=@/path/to/你的图片.jpg"
```

**响应示例：**

```json
{
  "success": true,
  "message": "图片上传成功",
  "data": {
    "filename": "image.jpg",
    "originalName": "原始文件名.jpg",
    "size": 1024000,
    "mimetype": "image/jpeg",
    "uploadTime": "2024-01-01T12:00:00.000Z",
    "url": "/api/images/image.jpg",
    "relPath": "image.jpg"
  }
}
```

### 📋 获取图片列表

```
GET /api/images
```

**参数说明：**

- `dir` (可选): 指定目录路径，如 "2024/06/10"

**curl 示例：**

```bash
# 获取根目录所有图片
curl http://localhost:3001/api/images

# 获取指定目录图片
curl "http://localhost:3001/api/images?dir=2024/06/10"
```

**响应示例：**

```json
{
  "success": true,
  "data": [
    {
      "filename": "image.jpg",
      "relPath": "image.jpg",
      "size": 1024000,
      "uploadTime": "2024-01-01T12:00:00.000Z",
      "url": "/api/images/image.jpg"
    }
  ]
}
```

### 🎲 获取随机图片

```
GET /api/random
```

**参数说明：**

- `dir` (可选): 指定目录路径

**curl 示例：**

```bash
# 获取根目录随机图片
curl http://localhost:3001/api/random

# 获取指定目录随机图片
curl "http://localhost:3001/api/random?dir=2024/06/10"
```

### 📊 获取统计信息

```
GET /api/stats
```

**参数说明：**

- `dir` (可选): 指定目录路径

**curl 示例：**

```bash
# 获取总体统计
curl http://localhost:3001/api/stats

# 获取指定目录统计
curl "http://localhost:3001/api/stats?dir=2024/06/10"
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "totalImages": 100,
    "totalSize": 104857600,
    "storagePath": "/app/uploads"
  }
}
```

### 📁 获取目录列表

```
GET /api/directories
```

## 更新日志

### v1.0.6 (最新)

- ✨ 新增主题切换功能
  - 支持浅色主题和暗色主题
  - 支持自动模式（根据时间自动切换）
  - 主题设置自动保存到本地存储
  - 所有页面和组件完美适配两种主题
  - 主题切换有平滑的过渡动画效果

### v1.0.5

- ✨ 新增移动端适配功能
  - 基于 Ant Design Grid 系统的响应式布局
  - 移动端使用抽屉式菜单导航
  - 自适应布局，根据屏幕尺寸自动调整
  - 移动端图片管理优化，单列布局
  - API 文档移动端适配，代码示例自动调整
  - 触摸操作优化，按钮和交互元素适配移动端

### v1.0.4

- ✨ 新增图片压缩工具功能
- ✨ 支持基于 Canvas API 的高质量图片压缩
- ✨ 支持设置压缩尺寸和质量参数
- ✨ 支持宽高比锁定，避免图片变形
- ✨ 实时显示压缩前后的大小对比和压缩率
- ✨ 支持压缩后直接上传到图床
- ✨ 支持本地下载压缩后的图片
- ✨ 智能默认尺寸计算，根据原始图片自动设置合适尺寸
- 🎨 优化压缩工具界面和用户体验

### v1.0.3

- ✨ 新增 SVG 转 PNG 工具功能
- ✨ 支持输入 SVG 代码实时转换为 PNG 图片
- ✨ 支持转换后直接上传到图床
- ✨ 提供 SVG 示例代码和在线预览
- ✨ 支持 PNG 图片下载功能
- ✨ 支持自定义上传和下载的文件名
- ✨ 支持基于时间戳自动生成文件名
- 🎨 优化工具界面和用户体验

### v1.0.2

- ✨ 新增路由功能，每个菜单都有独立的路由地址
- ✨ 支持页面刷新后保持在当前页面
- ✨ 支持直接通过 URL 访问各个页面
- ✨ 支持浏览器前进后退功能
- ⚙️ 优化可配置功能，支持自定义图片格式和文件大小限制
- 🎨 优化用户界面和交互体验

### v1.0.1

- ✨ 新增子目录管理功能
- ✨ 智能目录选择器
- ✨ 目录信息展示
- ✨ 支持输入新目录
- 🎨 优化用户界面

### v1.0.0

- 🎉 初始版本发布
- 📤 图片上传功能
- 🖼️ 图片管理功能
- 📊 统计信息功能
