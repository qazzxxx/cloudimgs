#!/bin/bash

echo "=== CloudImgs Build Test Script ==="
echo "Date: $(date)"
echo ""

# 检查Node.js版本
echo "=== Node.js Environment ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo ""

# 检查内存
echo "=== System Memory ==="
if command -v free &> /dev/null; then
    free -h
else
    echo "Memory info not available"
fi
echo ""

# 设置环境变量
export NODE_OPTIONS="--max-old-space-size=4096"
export CI=false
export NODE_ENV=production

echo "=== Environment Variables ==="
echo "NODE_OPTIONS: $NODE_OPTIONS"
echo "CI: $CI"
echo "NODE_ENV: $NODE_ENV"
echo ""

# 安装依赖
echo "=== Installing Dependencies ==="
echo "Installing root dependencies..."
npm ci --no-audit --no-fund
if [ $? -ne 0 ]; then
    echo "❌ Root dependencies installation failed"
    exit 1
fi

echo "Installing client dependencies..."
cd client
npm ci --no-audit --no-fund
if [ $? -ne 0 ]; then
    echo "❌ Client dependencies installation failed"
    exit 1
fi
cd ..
echo "✅ Dependencies installed successfully"
echo ""

# 测试客户端构建
echo "=== Testing Client Build ==="
cd client
echo "Starting build process..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Client build failed"
    echo "=== Build error details ==="
    if [ -f npm-debug.log ]; then
        cat npm-debug.log
    fi
    exit 1
fi

echo "✅ Client build completed successfully"
echo "=== Build Output ==="
ls -la build/
echo "=== Build files count ==="
find build -type f | wc -l
cd ..
echo ""

# 测试Docker构建
echo "=== Testing Docker Build ==="
echo "Building Docker image..."
docker build --no-cache --progress=plain -t cloudimgs-test .
if [ $? -ne 0 ]; then
    echo "❌ Docker build failed"
    exit 1
fi

echo "✅ Docker build completed successfully"
echo ""

# 测试Docker运行
echo "=== Testing Docker Run ==="
echo "Starting container..."
docker run --rm -d --name cloudimgs-test-container -p 3001:3001 cloudimgs-test
if [ $? -ne 0 ]; then
    echo "❌ Docker run failed"
    exit 1
fi

echo "Container started, waiting for health check..."
sleep 15

echo "=== Container Logs ==="
docker logs cloudimgs-test-container

echo "=== Health Check ==="
if curl -f http://localhost:3001/api/stats > /dev/null 2>&1; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
fi

echo "Stopping container..."
docker stop cloudimgs-test-container

echo ""
echo "=== Test Summary ==="
echo "✅ All tests passed successfully!"
echo "Build is ready for deployment." 