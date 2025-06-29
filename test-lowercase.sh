#!/bin/bash

echo "=== 测试小写转换逻辑 ==="
echo ""

# 模拟GitHub Actions环境变量
export GITHUB_REPOSITORY_OWNER="Qazzxxx"
export GITHUB_REPOSITORY="Qazzxxx/cloudimgs"

echo "=== 原始值 ==="
echo "GITHUB_REPOSITORY_OWNER: $GITHUB_REPOSITORY_OWNER"
echo "GITHUB_REPOSITORY: $GITHUB_REPOSITORY"
echo ""

# 测试小写转换
OWNER=$(echo "$GITHUB_REPOSITORY_OWNER" | tr '[:upper:]' '[:lower:]')
IMAGE_NAME="ghcr.io/$OWNER/cloudimgs"

echo "=== 转换后 ==="
echo "OWNER (小写): $OWNER"
echo "IMAGE_NAME: $IMAGE_NAME"
echo ""

# 验证格式
echo "=== 验证结果 ==="
if [[ "$OWNER" =~ ^[a-z0-9_-]+$ ]]; then
    echo "✅ OWNER 格式正确: $OWNER"
else
    echo "❌ OWNER 格式错误: $OWNER"
fi

if [[ "$IMAGE_NAME" =~ ^ghcr\.io/[a-z0-9_-]+/cloudimgs$ ]]; then
    echo "✅ IMAGE_NAME 格式正确: $IMAGE_NAME"
else
    echo "❌ IMAGE_NAME 格式错误: $IMAGE_NAME"
fi

echo ""
echo "=== GitHub Actions 输出格式 ==="
echo "在 GitHub Actions 中应该这样设置输出："
echo "echo \"owner=$OWNER\" >> \$GITHUB_OUTPUT"
echo "echo \"image_name=$IMAGE_NAME\" >> \$GITHUB_OUTPUT"
echo ""
echo "然后在后续步骤中使用："
echo "tags: \${{ steps.image_name.outputs.image_name }}:latest" 