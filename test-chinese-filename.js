const path = require("path");
const fs = require("fs");

// 模拟sanitizeFilename函数
function sanitizeFilename(filename) {
  try {
    // 如果文件名已经被编码，先解码
    if (filename.includes("%")) {
      filename = decodeURIComponent(filename);
    }
    // 处理可能的 Buffer 编码问题
    if (Buffer.isBuffer(filename)) {
      filename = filename.toString("utf8");
    }
    // 移除或替换不安全的字符，但保留中文字符
    filename = filename.replace(/[<>:"/\\|?*]/g, "_");
    return filename;
  } catch (error) {
    console.warn("文件名处理错误:", error);
    // 如果解码失败，使用原始文件名但清理不安全字符
    return filename.replace(/[<>:"/\\|?*]/g, "_");
  }
}

// 测试中文文件名
const testFilenames = [
  "测试图片.jpg",
  "我的照片.png",
  "风景照_2024.jpg",
  "test-image.jpg",
  "图片 (1).png",
];

console.log("测试中文文件名处理:");
testFilenames.forEach((filename) => {
  const sanitized = sanitizeFilename(filename);
  console.log(`原始: ${filename} -> 处理后: ${sanitized}`);
});

// 测试文件系统操作
console.log("\n测试文件系统操作:");
const testDir = "./test-chinese";
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir);
}

testFilenames.forEach((filename) => {
  const sanitized = sanitizeFilename(filename);
  const filePath = path.join(testDir, sanitized);

  // 创建空文件
  fs.writeFileSync(filePath, "");
  console.log(`创建文件: ${filePath}`);

  // 读取目录
  const files = fs.readdirSync(testDir);
  console.log(`目录内容: ${files.join(", ")}`);
});

// 清理测试文件
fs.rmSync(testDir, { recursive: true, force: true });
console.log("\n测试完成，已清理测试文件");
