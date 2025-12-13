# 多阶段构建 - 构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装构建工具和依赖
RUN apk add --no-cache git python3 make g++

# 设置Node.js内存限制（避免OOM）
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 设置npm配置
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_PROGRESS=false
ENV NPM_CONFIG_LOGLEVEL=warn

# 复制package.json文件
COPY package*.json ./

# 安装所有依赖（包括开发依赖，用于构建）
RUN npm ci --no-audit --no-fund --prefer-offline

# 复制客户端package.json
COPY client/package*.json ./client/

# 安装客户端依赖（添加详细输出和错误处理）
RUN cd client && \
    echo "=== Installing client dependencies ===" && \
    npm ci --no-audit --no-fund --prefer-offline --verbose && \
    echo "=== Client dependencies installed successfully ==="

# 复制源代码
COPY . .

# 显示构建环境信息
RUN echo "=== Build Environment Info ===" && \
    node --version && \
    npm --version && \
    echo "=== Current Directory ===" && \
    pwd && \
    ls -la && \
    echo "=== Client Directory ===" && \
    ls -la client/

# 验证客户端依赖安装
RUN echo "=== Client Dependencies Check ===" && \
    cd client && \
    ls -la node_modules/ | head -10 && \
    echo "=== React version ===" && \
    npm list react && \
    echo "=== React-scripts version ===" && \
    npm list react-scripts

# 构建客户端（添加详细输出和错误处理）
RUN cd client && \
    echo "=== Starting client build ===" && \
    echo "=== Available memory ===" && \
    free -h || echo "Memory info not available" && \
    echo "=== Node options ===" && \
    echo $NODE_OPTIONS && \
    echo "=== NPM version ===" && \
    npm --version && \
    echo "=== Node version ===" && \
    node --version && \
    echo "=== Starting build process ===" && \
    echo "=== Build environment ===" && \
    echo "CI: $CI" && \
    echo "NODE_ENV: $NODE_ENV" && \
    echo "=== Running build command ===" && \
    CI=false npm run build || (echo "Build failed with exit code $?" && echo "=== Build error details ===" && cat npm-debug.log* 2>/dev/null || echo "No npm debug log found" && exit 1)

# 验证构建结果
RUN echo "=== Build Result ===" && \
    ls -la client/build/ && \
    echo "=== Build files count ===" && \
    find client/build -type f | wc -l && \
    echo "=== Main JS file size ===" && \
    ls -lh client/build/static/js/ && \
    echo "=== Build successful ==="

# 生产阶段
FROM node:18-alpine AS production

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cloudimgs -u 1001

# 设置工作目录
WORKDIR /app

# 从构建阶段复制node_modules和应用文件
COPY --from=builder --chown=cloudimgs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=cloudimgs:nodejs /app/package*.json ./
COPY --from=builder --chown=cloudimgs:nodejs /app/server ./server
COPY --from=builder --chown=cloudimgs:nodejs /app/config.js ./
COPY --from=builder --chown=cloudimgs:nodejs /app/client/build ./client/build

# 创建上传目录并设置权限
RUN mkdir -p uploads logs && \
    chown -R cloudimgs:nodejs uploads logs

# 验证文件复制
RUN echo "=== Production Image Verification ===" && \
    ls -la client/build/ && \
    echo "=== Node modules verification ===" && \
    ls -la node_modules/ | head -10

# 切换到非root用户
USER cloudimgs

# 暴露端口
EXPOSE 3001

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001
ENV STORAGE_PATH=/app/uploads

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/stats', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 启动应用
CMD ["npm", "start"] 
