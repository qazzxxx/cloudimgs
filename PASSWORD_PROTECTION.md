# CloudImgs 密码保护功能

## 功能概述

CloudImgs 现在支持可选的密码保护功能，可以通过环境变量 `PASSWORD` 来启用。启用后，用户需要输入正确的密码才能访问系统的管理功能。

## 功能特性

### 🔐 安全保护

- **可选启用**: 通过环境变量控制是否启用密码保护
- **API 保护**: 所有管理接口都需要密码验证
- **前端保护**: 未登录用户无法访问管理界面

### 🎨 用户体验

- **美观登录界面**: 现代化的登录界面设计
- **会话管理**: 登录状态自动保存到本地存储
- **退出登录**: 支持手动退出登录
- **响应式设计**: 完美适配桌面端和移动端

### 🔧 技术实现

- **中间件验证**: 服务器端统一的密码验证中间件
- **请求拦截**: 前端自动为所有 API 请求添加密码头
- **错误处理**: 完善的错误处理和用户提示

## 配置方法

### 1. 环境变量配置

#### Docker 部署

```yaml
# docker-compose.yml
environment:
  - PASSWORD=your_secure_password_here
```

#### 直接部署

```bash
# 设置环境变量
export PASSWORD=your_secure_password_here

# 或使用 .env 文件
echo "PASSWORD=your_secure_password_here" >> .env
```

### 2. 启用/禁用

- **启用密码保护**: 设置 `PASSWORD` 环境变量
- **禁用密码保护**: 不设置 `PASSWORD` 环境变量或设置为空

## API 接口

### 认证接口

#### 检查认证状态

```
GET /api/auth/status
```

响应示例：

```json
{
  "requiresPassword": true
}
```

#### 验证密码

```
POST /api/auth/verify
```

请求体：

```json
{
  "password": "your_password"
}
```

响应示例：

```json
{
  "success": true,
  "message": "密码验证成功"
}
```

### 受保护的接口

以下接口在启用密码保护时需要提供密码：

- `POST /api/upload` - 上传图片
- `GET /api/images` - 获取图片列表
- `GET /api/random` - 获取随机图片
- `DELETE /api/images/*` - 删除图片
- `GET /api/directories` - 获取目录列表
- `GET /api/stats` - 获取统计信息

### 密码传递方式

#### 1. 请求头方式（推荐）

```bash
curl -H "X-Access-Password: your_password" \
     http://localhost:3001/api/stats
```

#### 2. 查询参数方式

```bash
curl "http://localhost:3001/api/stats?password=your_password"
```

#### 3. 请求体方式（仅限 POST 请求）

```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"password": "your_password"}' \
     http://localhost:3001/api/upload
```

## 前端实现

### 登录组件

- 位置: `client/src/components/LoginComponent.js`
- 功能: 密码输入和验证
- 特性: 响应式设计，错误提示

### API 工具

- 位置: `client/src/utils/api.js`
- 功能: axios 实例配置和拦截器
- 特性: 自动添加密码头，错误处理

### 应用集成

- 位置: `client/src/App.js`
- 功能: 认证状态管理
- 特性: 自动检查认证状态，路由保护

## 服务器端实现

### 密码验证中间件

- 位置: `server/index.js` 中的 `requirePassword` 函数
- 功能: 统一的密码验证逻辑
- 特性: 支持多种密码传递方式

### 认证接口

- `GET /api/auth/status` - 检查是否需要密码保护
- `POST /api/auth/verify` - 验证密码

### 配置集成

- 位置: `config.js`
- 功能: 密码配置管理
- 特性: 环境变量读取，配置验证

## 安全考虑

### 密码存储

- 密码不存储在数据库中
- 仅通过环境变量配置
- 建议使用强密码

### 传输安全

- 密码通过请求头或参数传递
- 建议在生产环境使用 HTTPS
- 避免在日志中记录密码

### 会话管理

- 前端使用 localStorage 存储登录状态
- 支持手动退出登录
- 密码错误时自动清除登录状态

## 测试

### 手动测试

1. 启动服务器（设置或不设置 PASSWORD 环境变量）
2. 访问前端界面
3. 验证登录流程和 API 访问

### 自动化测试

运行测试脚本：

```bash
node test-password.js
```

## 故障排除

### 常见问题

1. **密码保护未生效**

   - 检查环境变量是否正确设置
   - 重启服务器使环境变量生效

2. **API 访问被拒绝**

   - 确认密码是否正确
   - 检查请求头格式是否正确

3. **前端无法登录**
   - 检查网络连接
   - 查看浏览器控制台错误信息

### 调试模式

在开发环境中，可以查看服务器日志来调试认证问题。

## 更新日志

### v1.0.7 (新增)

- ✨ 新增密码保护功能
  - 支持通过环境变量启用密码保护
  - 美观的登录界面
  - 完整的 API 保护
  - 会话管理和退出登录
  - 响应式设计适配
