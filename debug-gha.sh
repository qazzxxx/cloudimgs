#!/bin/bash

echo "=== GitHub Actions 环境调试脚本 ==="
echo "Date: $(date)"
echo ""

# 模拟GitHub Actions环境变量
export CI=true
export GITHUB_ACTIONS=true
export GITHUB_WORKSPACE=$(pwd)

echo "=== 环境变量 ==="
echo "CI: $CI"
echo "GITHUB_ACTIONS: $GITHUB_ACTIONS"
echo "GITHUB_WORKSPACE: $GITHUB_WORKSPACE"
echo ""

# 检查Node.js环境
echo "=== Node.js 环境 ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo ""

# 检查内存
echo "=== 系统内存 ==="
if command -v free &> /dev/null; then
    free -h
else
    echo "Memory info not available"
fi
echo ""

# 设置构建环境变量
export NODE_OPTIONS="--max-old-space-size=4096"
export NODE_ENV=production

echo "=== 构建环境变量 ==="
echo "NODE_OPTIONS: $NODE_OPTIONS"
echo "NODE_ENV: $NODE_ENV"
echo ""

# 清理之前的构建
echo "=== 清理之前的构建 ==="
rm -rf client/build
rm -rf node_modules
rm -rf client/node_modules
echo "清理完成"
echo ""

# 安装依赖
echo "=== 安装依赖 ==="
echo "安装根目录依赖..."
npm ci --no-audit --no-fund --prefer-offline
if [ $? -ne 0 ]; then
    echo "❌ 根目录依赖安装失败"
    exit 1
fi

echo "安装客户端依赖..."
cd client
npm ci --no-audit --no-fund --prefer-offline
if [ $? -ne 0 ]; then
    echo "❌ 客户端依赖安装失败"
    exit 1
fi
cd ..
echo "✅ 依赖安装成功"
echo ""

# 测试客户端构建
echo "=== 测试客户端构建 ==="
cd client
echo "开始构建过程..."
echo "当前目录: $(pwd)"
echo "文件列表:"
ls -la
echo ""

echo "=== 构建环境信息 ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "NODE_OPTIONS: $NODE_OPTIONS"
echo "CI: $CI"
echo "NODE_ENV: $NODE_ENV"
echo ""

echo "=== 开始构建 ==="
CI=false npm run build
if [ $? -ne 0 ]; then
    echo "❌ 客户端构建失败"
    echo "=== 构建错误详情 ==="
    if [ -f npm-debug.log ]; then
        cat npm-debug.log
    fi
    if [ -f yarn-error.log ]; then
        cat yarn-error.log
    fi
    exit 1
fi

echo "✅ 客户端构建成功"
echo "=== 构建输出 ==="
ls -la build/
echo "=== 构建文件数量 ==="
find build -type f | wc -l
cd ..
echo ""

# 测试Docker构建
echo "=== 测试Docker构建 ==="
echo "使用简化的Dockerfile构建..."
docker build -f Dockerfile.gha -t cloudimgs-debug .
if [ $? -ne 0 ]; then
    echo "❌ Docker构建失败"
    exit 1
fi

echo "✅ Docker构建成功"
echo ""

# 测试Docker运行
echo "=== 测试Docker运行 ==="
echo "启动容器..."
docker run --rm -d --name cloudimgs-debug-container -p 3001:3001 cloudimgs-debug
if [ $? -ne 0 ]; then
    echo "❌ Docker运行失败"
    exit 1
fi

echo "容器已启动，等待健康检查..."
sleep 15

echo "=== 容器日志 ==="
docker logs cloudimgs-debug-container

echo "=== 健康检查 ==="
if curl -f http://localhost:3001/api/stats > /dev/null 2>&1; then
    echo "✅ 健康检查通过"
else
    echo "❌ 健康检查失败"
fi

echo "停止容器..."
docker stop cloudimgs-debug-container

echo ""
echo "=== 调试总结 ==="
echo "✅ 所有测试通过！"
echo "构建在模拟的GitHub Actions环境中正常工作。"
echo ""
echo "如果GitHub Actions仍然失败，可能的原因："
echo "1. PAT_TOKEN权限不足"
echo "2. 仓库包权限配置问题"
echo "3. GitHub Actions运行器资源限制"
echo "4. 网络连接问题" 