# 多阶段构建 - 构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制package.json文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制客户端package.json
COPY client/package*.json ./client/

# 安装客户端依赖
RUN cd client && npm ci

# 复制源代码
COPY . .

# 构建客户端
RUN cd client && npm run build

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