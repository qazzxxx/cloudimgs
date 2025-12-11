#!/bin/bash

echo "🚀 启动 云图 应用..."

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装，请先安装 npm"
    exit 1
fi

echo "📦 安装后端依赖..."
npm install

echo "📦 安装前端依赖..."
cd client && npm install && cd ..

echo "🔨 构建前端..."
cd client && npm run build && cd ..

echo "🌐 启动服务器..."
echo "✅ 应用已启动！"
echo "📍 访问地址: http://localhost:3001"
echo "🛑 按 Ctrl+C 停止服务"

npm start 