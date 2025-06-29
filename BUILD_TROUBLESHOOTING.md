# GitHub Actions 构建问题故障排除指南

## 问题描述

在 GitHub Actions 中推送 Docker 镜像到 GitHub Packages 时，构建失败并出现以下错误：

```
buildx failed with: ERROR: failed to build: failed to solve: process "/bin/sh -c cd client && npm run build" did not complete successfully: exit code: 1
```

或者：

```
buildx failed with: ERROR: failed to build: invalid tag "ghcr.io/Qazzxxx/cloudimgs:latest": repository name must be lowercase
```

## 常见原因和解决方案

### 1. 内存不足问题

**症状**: 构建过程中出现 OOM (Out of Memory) 错误
**解决方案**:

- 在 Dockerfile 中设置 `NODE_OPTIONS="--max-old-space-size=4096"`
- 在 GitHub Actions 中增加内存限制
- 使用单平台构建而不是多平台构建

### 2. CI 环境问题

**症状**: 在 CI 环境中构建失败，但本地构建成功
**解决方案**:

- 设置 `CI=false` 环境变量
- 禁用某些 CI 特定的检查

### 3. 依赖安装问题

**症状**: npm install 或 npm ci 失败
**解决方案**:

- 使用 `--no-audit --no-fund` 参数
- 添加 `--prefer-offline` 参数
- 确保所有依赖版本兼容

### 4. 构建工具缺失

**症状**: 编译原生模块失败
**解决方案**:

- 在 Dockerfile 中安装必要的构建工具：`python3 make g++`
- 确保使用正确的 Node.js 版本

### 5. GitHub Actions 特定问题

**症状**: 在 GitHub Actions 中失败，但本地测试成功
**解决方案**:

- 检查 PAT_TOKEN 权限配置
- 验证仓库包权限设置
- 使用简化的构建配置

### 6. Docker 镜像标签大小写问题

**症状**: `invalid tag: repository name must be lowercase`
**解决方案**:

- 使用 `github.repository_owner` 而不是 `github.repository`
- 确保镜像名称全部小写
- 运行 `./validate-image-name.sh` 验证正确的镜像名称

## 已实施的修复

### 1. 优化的 Dockerfile

- 增加了内存限制设置
- 添加了构建工具安装
- 改进了错误处理和日志输出
- 设置了 CI=false 环境变量

### 2. 改进的 GitHub Actions 工作流

- 简化了平台构建（只构建 linux/amd64）
- 增加了详细的错误报告
- 添加了构建参数传递
- 修复了镜像标签大小写问题

### 3. 测试脚本

- 创建了本地测试脚本 `test-build.sh`
- 创建了简化的测试 Dockerfile `Dockerfile.test`
- 创建了 GitHub Actions 专用 Dockerfile `Dockerfile.gha`
- 创建了调试脚本 `debug-gha.sh`
- 创建了镜像名称验证脚本 `validate-image-name.sh`

## 调试步骤

### 1. 本地测试

```bash
# 运行本地测试脚本
./test-build.sh

# 运行 GitHub Actions 环境调试脚本
./debug-gha.sh

# 验证镜像名称
./validate-image-name.sh

# 或者手动测试
cd client
npm ci
CI=false npm run build
```

### 2. 使用简化的 Dockerfile 测试

```bash
# 使用简化的 Dockerfile 进行测试
docker build -f Dockerfile.test -t test-build .

# 使用 GitHub Actions 专用 Dockerfile
docker build -f Dockerfile.gha -t gha-test .
```

### 3. 检查构建日志

- 查看 GitHub Actions 的详细日志
- 检查是否有特定的错误信息
- 验证所有依赖是否正确安装

## 推荐的 GitHub Actions 配置

### 1. 使用单平台构建

```yaml
platforms: linux/amd64 # 而不是 linux/amd64,linux/arm64
```

### 2. 传递构建参数

```yaml
build-args: |
  NODE_OPTIONS=--max-old-space-size=4096
```

### 3. 增加超时时间

```yaml
timeout: 30m # 增加构建超时时间
```

### 4. 使用简化的工作流

尝试使用 `.github/workflows/package-simple.yml` 进行测试。

### 5. 正确的镜像名称格式

```yaml
# 使用 repository_owner 确保小写
images: ghcr.io/${{ github.repository_owner }}/cloudimgs
# 或者
tags: ghcr.io/${{ github.repository_owner }}/cloudimgs:latest
```

## 预防措施

### 1. 定期更新依赖

- 定期更新 package.json 中的依赖版本
- 测试新版本的兼容性

### 2. 本地验证

- 在推送前在本地运行完整的构建测试
- 使用与 CI 环境相同的 Node.js 版本

### 3. 监控构建

- 设置构建失败通知
- 定期检查构建日志

## 故障排除检查清单

### 1. 权限检查

- [ ] PAT_TOKEN 是否具有 `write:packages` 权限
- [ ] 仓库是否启用了 GitHub Packages
- [ ] 工作流是否具有正确的权限配置

### 2. 环境检查

- [ ] Node.js 版本是否兼容
- [ ] 内存是否足够
- [ ] 网络连接是否正常

### 3. 代码检查

- [ ] 所有依赖是否正确安装
- [ ] 是否有语法错误
- [ ] 构建脚本是否正确

### 4. 配置检查

- [ ] Dockerfile 是否正确
- [ ] .dockerignore 是否排除必要文件
- [ ] GitHub Actions 工作流配置是否正确
- [ ] 镜像名称是否全部小写

## 联系支持

如果问题仍然存在，请：

1. 运行本地测试脚本并分享输出
2. 提供 GitHub Actions 的完整构建日志
3. 检查是否有特定的错误模式
4. 验证 PAT_TOKEN 权限配置
5. 运行 `./validate-image-name.sh` 验证镜像名称

## 相关文件

- `Dockerfile` - 主要的 Docker 构建文件
- `Dockerfile.test` - 简化的测试 Dockerfile
- `Dockerfile.gha` - GitHub Actions 专用 Dockerfile
- `test-build.sh` - 本地测试脚本
- `debug-gha.sh` - GitHub Actions 环境调试脚本
- `validate-image-name.sh` - 镜像名称验证脚本
- `.github/workflows/package.yml` - GitHub Packages 工作流
- `.github/workflows/package-simple.yml` - 简化的工作流
- `.github/workflows/test-build.yml` - 测试构建工作流
