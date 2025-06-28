# 使用官方Node.js运行时作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制客户端package.json
COPY client/package*.json ./client/

# 安装客户端依赖
RUN cd client && npm install

# 复制源代码
COPY . .

# 构建客户端
RUN cd client && npm run build

# 创建上传目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3001

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001
ENV STORAGE_PATH=/app/uploads

# 启动应用
CMD ["npm", "start"] 