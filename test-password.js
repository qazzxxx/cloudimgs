const axios = require("axios");

const BASE_URL = "http://localhost:3001";

async function testPasswordProtection() {
  console.log("🧪 测试密码保护功能...\n");

  try {
    // 1. 测试认证状态检查
    console.log("1. 检查认证状态...");
    const statusResponse = await axios.get(`${BASE_URL}/api/auth/status`);
    console.log("   认证状态:", statusResponse.data);

    if (statusResponse.data.requiresPassword) {
      console.log("   ✅ 密码保护已启用");

      // 2. 测试密码验证（错误密码）
      console.log("\n2. 测试错误密码...");
      try {
        await axios.post(`${BASE_URL}/api/auth/verify`, {
          password: "wrong_password",
        });
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log("   ✅ 错误密码被正确拒绝");
        } else {
          console.log("   ❌ 错误密码处理异常:", error.response?.data);
        }
      }

      // 3. 测试密码验证（正确密码）
      console.log("\n3. 测试正确密码...");
      try {
        const verifyResponse = await axios.post(`${BASE_URL}/api/auth/verify`, {
          password: process.env.PASSWORD || "test_password",
        });
        console.log("   ✅ 正确密码验证成功:", verifyResponse.data);
      } catch (error) {
        console.log("   ❌ 正确密码验证失败:", error.response?.data);
      }

      // 4. 测试API访问（无密码）
      console.log("\n4. 测试API访问（无密码）...");
      try {
        await axios.get(`${BASE_URL}/api/stats`);
        console.log("   ❌ API应该被拒绝但没有");
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log("   ✅ API正确拒绝了无密码访问");
        } else {
          console.log("   ❌ API拒绝处理异常:", error.response?.data);
        }
      }

      // 5. 测试API访问（有密码）
      console.log("\n5. 测试API访问（有密码）...");
      try {
        const statsResponse = await axios.get(`${BASE_URL}/api/stats`, {
          headers: {
            "X-Access-Password": process.env.PASSWORD || "test_password",
          },
        });
        console.log("   ✅ API访问成功:", statsResponse.data);
      } catch (error) {
        console.log("   ❌ API访问失败:", error.response?.data);
      }
    } else {
      console.log("   ℹ️  密码保护未启用");

      // 测试API访问（应该可以直接访问）
      console.log("\n2. 测试API访问（无密码保护）...");
      try {
        const statsResponse = await axios.get(`${BASE_URL}/api/stats`);
        console.log("   ✅ API可以直接访问:", statsResponse.data);
      } catch (error) {
        console.log("   ❌ API访问失败:", error.response?.data);
      }
    }
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    if (error.code === "ECONNREFUSED") {
      console.log("   请确保服务器正在运行 (node server/index.js)");
    }
  }
}

// 运行测试
testPasswordProtection();
