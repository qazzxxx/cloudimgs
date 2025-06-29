#!/bin/bash

echo "=== Docker 镜像名称验证脚本 ==="
echo ""

# 获取GitHub仓库信息
REPO_OWNER=$(git remote get-url origin | sed -n 's/.*github\.com[:/]\([^/]*\)\/.*/\1/p')
REPO_NAME=$(basename -s .git $(git remote get-url origin))

echo "=== 仓库信息 ==="
echo "Repository Owner: $REPO_OWNER"
echo "Repository Name: $REPO_NAME"
echo "Full Repository: $REPO_OWNER/$REPO_NAME"
echo ""

# 生成正确的镜像名称
LOWERCASE_OWNER=$(echo "$REPO_OWNER" | tr '[:upper:]' '[:lower:]')
LOWERCASE_NAME=$(echo "$REPO_NAME" | tr '[:upper:]' '[:lower:]')

echo "=== 正确的镜像名称 ==="
echo "GitHub Container Registry:"
echo "  ghcr.io/$LOWERCASE_OWNER/$LOWERCASE_NAME:latest"
echo "  ghcr.io/$LOWERCASE_OWNER/$LOWERCASE_NAME:v1.0.0"
echo ""
echo "Docker Hub (如果需要):"
echo "  $LOWERCASE_OWNER/$LOWERCASE_NAME:latest"
echo ""

# 验证镜像名称格式
echo "=== 验证结果 ==="
if [[ "$LOWERCASE_OWNER" =~ ^[a-z0-9_-]+$ ]]; then
    echo "✅ Repository Owner 格式正确: $LOWERCASE_OWNER"
else
    echo "❌ Repository Owner 格式错误: $LOWERCASE_OWNER"
fi

if [[ "$LOWERCASE_NAME" =~ ^[a-z0-9_-]+$ ]]; then
    echo "✅ Repository Name 格式正确: $LOWERCASE_NAME"
else
    echo "❌ Repository Name 格式错误: $LOWERCASE_NAME"
fi

echo ""
echo "=== GitHub Actions 配置建议 ==="
echo "在 .github/workflows/package.yml 中使用:"
echo "  images: ghcr.io/$LOWERCASE_OWNER/$LOWERCASE_NAME"
echo ""
echo "或者在简化版本中使用:"
echo "  tags: ghcr.io/$LOWERCASE_OWNER/$LOWERCASE_NAME:latest" 