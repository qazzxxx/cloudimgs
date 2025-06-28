const axios = require("axios");

const BASE_URL = "http://localhost:3001";

async function testAPI() {
  console.log("🧪 开始测试 API 接口...\n");

  try {
    // 测试获取统计信息
    console.log("1. 测试获取统计信息...");
    const statsResponse = await axios.get(`${BASE_URL}/api/stats`);
    console.log("✅ 统计信息:", statsResponse.data);
    console.log("");

    // 测试获取图片列表
    console.log("2. 测试获取图片列表...");
    const imagesResponse = await axios.get(`${BASE_URL}/api/images`);
    console.log("✅ 图片列表:", imagesResponse.data);
    console.log("");

    // 测试获取随机图片
    console.log("3. 测试获取随机图片...");
    try {
      const randomResponse = await axios.get(`${BASE_URL}/api/random`);
      console.log("✅ 随机图片:", randomResponse.data);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log("ℹ️  没有图片，这是正常的");
      } else {
        console.log("❌ 获取随机图片失败:", error.message);
      }
    }
    console.log("");

    console.log("🎉 API 测试完成！");
    console.log("📝 要测试上传功能，请使用网页界面或 curl 命令");
    console.log(
      '💡 示例: curl -X POST -F "image=@test.jpg" http://localhost:3001/api/upload'
    );
  } catch (error) {
    console.error("❌ API 测试失败:", error.message);
    console.log("💡 请确保服务器正在运行 (npm start)");
  }
}

// 检查服务器是否运行
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/api/stats`);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log("🔍 检查服务器状态...");
  const isRunning = await checkServer();

  if (!isRunning) {
    console.log("❌ 服务器未运行");
    console.log("💡 请先启动服务器: npm start");
    return;
  }

  console.log("✅ 服务器正在运行");
  await testAPI();
}

main();
