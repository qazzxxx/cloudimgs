import React from "react";
import { Table, Card, Typography, Space, Tag, Divider, Button, message } from "antd";
import { getPassword } from "../utils/secureStorage";
import { ApiOutlined, InfoCircleOutlined } from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;

const ApiDocsComponent = ({ currentTheme = "light" }) => {
  // 主题相关样式
  const isDark = currentTheme === "dark";
  const themeStyles = {
    // 背景色
    bgContainer: isDark ? "#141414" : "#ffffff",
    bgElevated: isDark ? "#1f1f1f" : "#ffffff",
    bgLayout: isDark ? "#000000" : "#f5f5f5",
    bgCodeBlock: isDark ? "#1a1a1a" : "#f6f8fa",
    bgInfoBox: isDark ? "#1a1a1a" : "#f6f8fa",

    // 边框色
    border: isDark ? "#303030" : "#d9d9d9",
    borderSecondary: isDark ? "#262626" : "#f0f0f0",

    // 文字色
    text: isDark ? "#ffffff" : "#000000",
    textSecondary: isDark ? "#a6a6a6" : "#666666",
    textCode: isDark ? "#e6f4ff" : "#1677ff",

    // 主色调
    primary: isDark ? "#177ddc" : "#1677ff",
    primaryHover: isDark ? "#1890ff" : "#4096ff",

    // 代码块文字色
    codeText: isDark ? "#d4d4d4" : "#24292e",

    // 代码块样式
    codeBlock: {
      background: isDark ? "#1e1e1e" : "#f8f9fa",
      border: `1px solid ${isDark ? "#404040" : "#e1e4e8"}`,
      borderRadius: "6px",
      padding: "1px 6px",
      fontFamily:
        "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
      fontSize: "13px",
      fontWeight: "500",
      color: isDark ? "#d4d4d4" : "#24292e",
      boxShadow: isDark
        ? "0 1px 3px rgba(0,0,0,0.3)"
        : "0 1px 2px rgba(0,0,0,0.05)",
    },

    // 接口URL样式
    endpointBlock: {
      background: isDark ? "#1e1e1e" : "#f8f9fa",
      border: `1px solid ${isDark ? "#404040" : "#e1e4e8"}`,
      borderRadius: "8px",
      padding: "8px 12px",
      fontFamily:
        "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
      fontSize: "14px",
      fontWeight: "600",
      color: isDark ? "#4ec9b0" : "#0550ae",
      boxShadow: isDark
        ? "0 2px 4px rgba(0,0,0,0.3)"
        : "0 2px 4px rgba(0,0,0,0.1)",
      letterSpacing: "0.3px",
    },
  };

  // API接口数据
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const savedPassword = typeof window !== "undefined" ? (getPassword() || "") : "";

  const copyText = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    const input = document.createElement("input");
    input.style.position = "fixed";
    input.style.top = "-10000px";
    input.style.zIndex = "-999";
    document.body.appendChild(input);
    input.value = text;
    input.focus();
    input.select();
    try {
      const ok = document.execCommand("copy");
      document.body.removeChild(input);
      if (!ok) {
        message.error("复制失败");
      } else {
        message.success("已复制");
      }
    } catch (e) {
      document.body.removeChild(input);
      message.error("浏览器不支持复制功能");
    }
  };

  const apiData = [
    {
      key: "base64",
      method: "POST",
      endpoint: "/api/upload-base64",
      description: "上传 base64 图片",
      auth: "需要",
      parameters: [
        { name: "base64Image", type: "string", required: "是", description: "dataURL 格式的图片数据" },
        { name: "dir", type: "string", required: "否", description: "存储目录路径（支持多层目录）" },
        { name: "originalName", type: "string", required: "否", description: "自定义原始文件名" },
        { name: "password", type: "string", required: "是*", description: "访问密码（如果启用了密码保护）" },
      ],
      response: {
        success: "boolean",
        message: "string",
        data: {
          filename: "string",
          originalName: "string",
          size: "number",
          mimetype: "string",
          uploadTime: "string",
          url: "string",
          relPath: "string",
        },
      },
    },
    {
      key: "1",
      method: "POST",
      endpoint: "/api/upload",
      description: "上传图片",
      auth: "需要",
      parameters: [
        {
          name: "image",
          type: "file",
          required: "是",
          description: "要上传的图片文件",
        },
        {
          name: "dir",
          type: "string",
          required: "否",
          description: "存储目录路径（支持多层目录）",
        },
        {
          name: "password",
          type: "string",
          required: "是*",
          description: "访问密码（如果启用了密码保护）",
        },
      ],
      response: {
        success: "boolean",
        message: "string",
        data: {
          filename: "string",
          originalName: "string",
          size: "number",
          mimetype: "string",
          uploadTime: "string",
          url: "string",
          relPath: "string",
        },
      },
    },
    {
      key: "2",
      method: "POST",
      endpoint: "/api/upload-file",
      description: "上传任意文件（支持MP3/MP4时长解析）",
      auth: "需要",
      parameters: [
        {
          name: "file",
          type: "file",
          required: "是",
          description: "要上传的文件",
        },
        {
          name: "dir",
          type: "string",
          required: "否",
          description: "存储目录路径（支持多层目录）",
        },
        {
          name: "filename",
          type: "string",
          required: "否",
          description: "自定义文件名（如以.mp3/.mp4结尾，将解析时长）",
        },
        {
          name: "password",
          type: "string",
          required: "是*",
          description: "访问密码（如果启用了密码保护）",
        },
      ],
      response: {
        success: "boolean",
        message: "string",
        data: {
          filename: "string",
          originalName: "string",
          customFilename: "string | null",
          size: "number",
          mimetype: "string",
          uploadTime: "string",
          url: "string",
          relPath: "string",
          duration: "number (可选，对于.mp3/.mp4文件)"
        },
      },
    },
    {
      key: "3",
      method: "GET",
      endpoint: "/api/random",
      description: "获取随机图片",
      auth: "需要",
      parameters: [
        {
          name: "dir",
          type: "string",
          required: "否",
          description: "指定目录路径（支持多层目录）",
        },
        {
          name: "format",
          type: "string",
          required: "否",
          description: "返回格式，json返回JSON数据，否则直接返回图片",
        },
        {
          name: "password",
          type: "string",
          required: "是*",
          description: "访问密码（如果启用了密码保护）",
        },
      ],
      response: "图片文件或JSON数据",
    },
    {
      key: "4",
      method: "GET",
      endpoint: "/api/images/*",
      description: "获取指定图片",
      auth: "否",
      parameters: [
        {
          name: "path",
          type: "string",
          required: "是",
          description: "图片路径（URL路径参数）",
        },
      ],
      response: "图片文件",
    },
    {
      key: "4.1",
      method: "GET",
      endpoint: "/api/files/*",
      description: "获取指定文件",
      auth: "否",
      parameters: [
        { name: "path", type: "string", required: "是", description: "文件路径（URL路径参数）" },
      ],
      response: "文件内容（自动设置Content-Type）",
    },
    {
      key: "5",
      method: "DELETE",
      endpoint: "/api/images/*",
      description: "删除图片",
      auth: "需要",
      parameters: [
        {
          name: "path",
          type: "string",
          required: "是",
          description: "图片路径（URL路径参数）",
        },
        {
          name: "password",
          type: "string",
          required: "是*",
          description: "访问密码（如果启用了密码保护）",
        },
      ],
      response: {
        success: "boolean",
      },
    },
    {
      key: "5.1",
      method: "DELETE",
      endpoint: "/api/files/*",
      description: "删除文件",
      auth: "需要",
      parameters: [
        { name: "path", type: "string", required: "是", description: "文件路径（URL路径参数）" },
        { name: "password", type: "string", required: "是*", description: "访问密码（如果启用了密码保护）" },
      ],
      response: { success: "boolean", message: "string" },
    },
    {
      key: "6",
      method: "GET",
      endpoint: "/api/directories",
      description: "获取目录列表",
      auth: "需要",
      parameters: [
        {
          name: "dir",
          type: "string",
          required: "否",
          description: "指定目录路径（支持多层目录）",
        },
        {
          name: "password",
          type: "string",
          required: "是*",
          description: "访问密码（如果启用了密码保护）",
        },
      ],
      response: {
        success: "boolean",
        data: [
          {
            name: "string",
            path: "string",
            fullPath: "string",
          },
        ],
      },
    },
    {
      key: "7",
      method: "GET",
      endpoint: "/api/stats",
      description: "获取统计信息",
      auth: "需要",
      parameters: [
        {
          name: "dir",
          type: "string",
          required: "否",
          description: "指定目录路径（支持多层目录）",
        },
        {
          name: "password",
          type: "string",
          required: "是*",
          description: "访问密码（如果启用了密码保护）",
        },
      ],
      response: {
        success: "boolean",
        data: {
          totalImages: "number",
          totalSize: "number",
          storagePath: "string",
        },
      },
    },
    {
      key: "8",
      method: "POST",
      endpoint: "/api/process-image",
      description: "处理图片并保存为指定尺寸PNG",
      auth: "需要",
      parameters: [
        { name: "image", type: "file", required: "是", description: "要处理的图片文件" },
        { name: "width", type: "number", required: "是", description: "目标宽度" },
        { name: "height", type: "number", required: "是", description: "目标高度" },
        { name: "dir", type: "string", required: "否", description: "存储目录路径" },
        { name: "password", type: "string", required: "是*", description: "访问密码（如果启用了密码保护）" },
      ],
      response: {
        success: "boolean",
        message: "string",
        data: {
          filename: "string",
          originalName: "string",
          processedSize: { width: "number", height: "number" },
          originalSize: { width: "number", height: "number" },
          size: "number",
          mimetype: "string",
          uploadTime: "string",
          url: "string",
          relPath: "string",
        },
      },
    },
    {
      key: "9",
      method: "POST",
      endpoint: "/api/svg2png",
      description: "SVG 转 PNG",
      auth: "需要",
      parameters: [
        { name: "svgCode", type: "string", required: "是", description: "SVG 源代码" },
        { name: "password", type: "string", required: "是*", description: "访问密码（如果启用了密码保护）" },
      ],
      response: "PNG 文件（二进制）",
    },
    {
      key: "10",
      method: "GET",
      endpoint: "/api/images",
      description: "获取图片列表（支持分页与搜索）",
      auth: "需要",
      parameters: [
        { name: "dir", type: "string", required: "否", description: "指定目录路径（支持多层目录）" },
        { name: "page", type: "number", required: "否", description: "页码，默认1" },
        { name: "pageSize", type: "number", required: "否", description: "每页数量，默认10" },
        { name: "search", type: "string", required: "否", description: "按文件名搜索（包含匹配）" },
        { name: "password", type: "string", required: "是*", description: "访问密码（如果启用了密码保护）" },
      ],
      response: {
        success: "boolean",
        data: "Image[]",
        pagination: {
          current: "number",
          pageSize: "number",
          total: "number",
          totalPages: "number",
        },
      },
    },
  ];

  const buildCurl = (api) => {
    const endpoint = `${origin}${api.endpoint}`;
    const pwdHeader = savedPassword ? ` -H "X-Access-Password: ${savedPassword}"` : "";
    const methodFlag = api.method && api.method !== "GET" ? ` -X ${api.method}` : "";

    if (api.endpoint === "/api/upload") {
      return `curl${methodFlag} ${endpoint}${pwdHeader} \\\n+  -F "image=@/path/to/image.jpg" \\\n+  -F "dir=my_folder"`;
    }
    if (api.endpoint === "/api/upload-file") {
      return `curl${methodFlag} ${endpoint}${pwdHeader} \\\n+  -F "file=@/path/to/file.ext" \\\n+  -F "dir=my_folder" \\\n+  -F "filename=custom.ext"`;
    }
    if (api.endpoint === "/api/upload-base64") {
      const payload = JSON.stringify({ base64Image: "data:image/png;base64,....", dir: "my_folder", originalName: "name.png" });
      return `curl${methodFlag} ${endpoint}${pwdHeader} \\\n+  -H "Content-Type: application/json" \\\n+  -d '${payload}'`;
    }
    if (api.endpoint === "/api/process-image") {
      return `curl${methodFlag} ${endpoint}${pwdHeader} \\\n+  -F "image=@/path/to/image.jpg" \\\n+  -F "width=800" \\\n+  -F "height=600" \\\n+  -F "dir=my_folder"`;
    }
    if (api.endpoint === "/api/svg2png") {
      const payload = JSON.stringify({ svgCode: "<svg>...</svg>" });
      return `curl${methodFlag} ${endpoint}${pwdHeader} \\\n+  -H "Content-Type: application/json" \\\n+  -d '${payload}'`;
    }
    if (api.endpoint === "/api/images") {
      const url = `${endpoint}?dir=my_folder&page=1&pageSize=10&search=keyword`;
      return `curl ${url}${pwdHeader}`;
    }
    if (api.endpoint === "/api/random") {
      const url = `${endpoint}?dir=my_folder&format=json`;
      return `curl ${url}${pwdHeader}`;
    }
    if (api.endpoint === "/api/auth/status") {
      return `curl ${endpoint}`;
    }
    if (api.endpoint === "/api/auth/verify") {
      const payload = JSON.stringify({ password: savedPassword || "your_password" });
      return `curl -X POST ${endpoint} \\\n+  -H "Content-Type: application/json" \\\n+  -d '${payload}'`;
    }
    if (api.endpoint === "/api/config") {
      return `curl ${endpoint}`;
    }
    if (api.endpoint === "/api/images/*") {
      const url = `${origin}/api/images/path/to/image.jpg`;
      return `curl ${url}`;
    }
    if (api.endpoint === "/api/files/*") {
      const url = `${origin}/api/files/path/to/file.ext`;
      return `curl ${url}`;
    }
    if (api.endpoint === "/api/images/*" && api.method === "DELETE") {
      const url = `${origin}/api/images/path/to/image.jpg`;
      return `curl -X DELETE ${url}${pwdHeader}`;
    }
    if (api.endpoint === "/api/files/*" && api.method === "DELETE") {
      const url = `${origin}/api/files/path/to/file.ext`;
      return `curl -X DELETE ${url}${pwdHeader}`;
    }
    return `curl${methodFlag} ${endpoint}${pwdHeader}`;
  };

  const handleCopyCurl = (api) => {
    const cmd = buildCurl(api);
    copyText(cmd);
  };

  // 参数表格列定义
  const parameterColumns = [
    {
      title: "参数名",
      dataIndex: "name",
      key: "name",
      width: 120,
      render: (text) => <span style={themeStyles.codeBlock}>{text}</span>,
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "必填",
      dataIndex: "required",
      key: "required",
      width: 80,
      render: (text) => (
        <Tag color={text === "是" || text === "是*" ? "red" : "green"}>
          {text}
        </Tag>
      ),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      render: (text) => (
        <span style={{ color: themeStyles.textSecondary }}>{text}</span>
      ),
    },
  ];

  // 注意：apiColumns 目前未使用，但保留以备将来扩展功能
  // const apiColumns = [
  //   {
  //     title: "方法",
  //     dataIndex: "method",
  //     key: "method",
  //     width: 100,
  //     render: (text) => {
  //       const colorMap = {
  //         GET: "green",
  //         POST: "blue",
  //         PUT: "orange",
  //         DELETE: "red",
  //       };
  //       return <Tag color={colorMap[text]}>{text}</Tag>;
  //     },
  //   },
  //   {
  //     title: "接口地址",
  //     dataIndex: "endpoint",
  //     key: "endpoint",
  //     width: 200,
  //     render: (text) => <Text code>{text}</Text>,
  //   },
  //   {
  //     title: "描述",
  //     dataIndex: "description",
  //     key: "description",
  //     width: 150,
  //   },
  //   {
  //     title: "认证",
  //     dataIndex: "auth",
  //     key: "auth",
  //     width: 80,
  //     render: (text) => (
  //       <Tag color={text === "需要" ? "red" : "green"}>
  //         {text === "需要" ? "需要" : "无需"}
  //       </Tag>
  //     ),
  //   },
  //   {
  //     title: "操作",
  //     key: "action",
  //     width: 120,
  //     render: (_, record) => (
  //       <button
  //         type="button"
  //         style={{ background: 'none', border: 'none', color: '#1677ff', cursor: 'pointer', padding: 0 }}
  //         onClick={() => record.expanded = !record.expanded}
  //       >
  //         查看参数
  //       </button>
  //     ),
  //   },
  // ];

  // 判断是否为移动端
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;

  // 响应式 codeBlock 样式
  const codeBlockStyle = {
    ...themeStyles.codeBlock,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    fontSize: isMobile ? "12px" : themeStyles.codeBlock.fontSize,
    padding: isMobile ? "1px 3px" : themeStyles.codeBlock.padding,
  };

  // 响应式 Card bodyStyle
  const cardBodyStyle = isMobile ? { padding: 10 } : { padding: 20 };

  // 响应式 gap
  const cardGap = isMobile ? 12 : 24;

  return (
    <div
      style={{
        width: "100%",
        margin: "0 auto",
        padding: isMobile ? "12px 4px" : "24px",
      }}
    >
      <Space
        direction="vertical"
        size={isMobile ? "small" : "large"}
        style={{ width: "100%" }}
      >
        {/* 标题和说明 */}
        <Card>
          <Space
            direction="vertical"
            size={isMobile ? "small" : "middle"}
            style={{ width: "100%" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: isMobile ? "flex-start" : "center",
                gap: isMobile ? 4 : 8,
                flexWrap: "wrap",
              }}
            >
              <ApiOutlined
                style={{
                  fontSize: isMobile ? "18px" : "24px",
                  color: themeStyles.primary,
                }}
              />
              <Title
                level={2}
                style={{
                  margin: 0,
                  color: themeStyles.text,
                  fontSize: isMobile ? 18 : 24,
                }}
              >
                开放接口文档
              </Title>
            </div>
            <Paragraph
              style={{
                color: themeStyles.textSecondary,
                fontSize: isMobile ? 13 : undefined,
              }}
            >
              <InfoCircleOutlined
                style={{ marginRight: "8px", color: themeStyles.primary }}
              />
              本文档详细列出了CloudImgs支持的所有API接口，包括参数说明、认证要求和返回格式。
            </Paragraph>
            <div
              style={{
                background: themeStyles.bgInfoBox,
                padding: isMobile ? "10px" : "16px",
                borderRadius: "6px",
                border: `1px solid ${themeStyles.border}`,
                fontSize: isMobile ? 12 : undefined,
                overflowX: "auto",
              }}
            >
              <span style={{ fontWeight: 600, color: themeStyles.text }}>
                认证说明：
              </span>
              <ul
                style={{
                  margin: "8px 0 0 0",
                  paddingLeft: "20px",
                  color: themeStyles.textSecondary,
                }}
              >
                <li>标记为"需要"的接口需要提供访问密码</li>
                <li>
                  密码可以通过请求头{" "}
                  <span style={codeBlockStyle}>x-access-password</span>、请求体{" "}
                  <span style={codeBlockStyle}>password</span> 或查询参数{" "}
                  <span style={codeBlockStyle}>password</span> 提供
                </li>
                <li>如果系统未启用密码保护，则无需提供密码</li>
              </ul>
            </div>
          </Space>
        </Card>

        {/* API接口列表 */}
        <Card title="接口列表" style={{ marginBottom: cardGap }}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: cardGap }}
          >
            {apiData.map((api) => (
              <Card
                key={api.key}
                type="inner"
                style={{ marginBottom: 0, width: "100%" }}
                bodyStyle={cardBodyStyle}
                bordered
              >
                <div style={{ marginBottom: isMobile ? 8 : 16 }}>
                  <Space size={isMobile ? 4 : "middle"} align="center" wrap>
                    <Tag
                      color={
                        api.method === "GET"
                          ? "green"
                          : api.method === "POST"
                          ? "blue"
                          : api.method === "DELETE"
                          ? "red"
                          : "orange"
                      }
                    >
                      {api.method}
                    </Tag>
                    <span style={codeBlockStyle}>{api.endpoint}</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: themeStyles.text,
                        fontSize: isMobile ? 13 : undefined,
                      }}
                    >
                      {api.description}
                    </span>
                    <Tag color={api.auth === "需要" ? "red" : "green"}>
                      {api.auth === "需要" ? "需要认证" : "无需认证"}
                    </Tag>
                    <span style={{ ...codeBlockStyle }}>
                      {origin}{api.endpoint}
                    </span>
                    {/* 移除密码明文展示，降低泄露风险 */}
                    <Button type="primary" size="small" onClick={() => handleCopyCurl(api)}>
                      复制 curl
                    </Button>
                  </Space>
                </div>

                {/* 参数表格 */}
                {api.parameters && api.parameters.length > 0 && (
                  <div style={{ marginBottom: isMobile ? 8 : 16 }}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: themeStyles.text,
                        fontSize: isMobile ? 13 : undefined,
                      }}
                    >
                      请求参数：
                    </span>
                    <Table
                      columns={parameterColumns}
                      dataSource={api.parameters}
                      pagination={false}
                      size={isMobile ? "small" : "middle"}
                      style={{ marginTop: "8px", width: "100%" }}
                      scroll={{ x: true }}
                    />
                  </div>
                )}

                {/* 响应说明 */}
                <div>
                  <span
                    style={{
                      fontWeight: 600,
                      color: themeStyles.text,
                      fontSize: isMobile ? 13 : undefined,
                    }}
                  >
                    响应格式：
                  </span>
                  <div
                    style={{
                      ...codeBlockStyle,
                      padding: isMobile ? "8px" : "12px",
                      marginTop: "8px",
                      fontFamily: "monospace",
                      fontSize: isMobile ? "12px" : "14px",
                      border: `1px solid ${themeStyles.border}`,
                      color: themeStyles.codeText,
                      width: "100%",
                    }}
                  >
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: themeStyles.codeText, fontSize: isMobile ? "12px" : "14px" }}>
                      {buildCurl(api)}
                    </pre>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {/* 使用示例 */}
        <Card title="使用示例">
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Text strong style={{ color: themeStyles.text }}>
                1. 上传图片（使用curl）：
              </Text>
              <div
                style={{
                  background: themeStyles.bgCodeBlock,
                  padding: "12px",
                  borderRadius: "6px",
                  marginTop: "8px",
                  fontFamily: "monospace",
                  fontSize: "14px",
                  border: `1px solid ${themeStyles.border}`,
                }}
              >
                <pre style={{ margin: 0, color: themeStyles.codeText }}>
                  {`curl -X POST http://localhost:3000/api/upload \\
  -H "x-access-password: your_password" \\
  -F "image=@/path/to/image.jpg" \\
  -F "dir=my_folder"`}
                </pre>
              </div>
            </div>

            <div>
              <Text strong style={{ color: themeStyles.text }}>
                2. 获取图片列表（使用fetch）：
              </Text>
              <div
                style={{
                  background: themeStyles.bgCodeBlock,
                  padding: "12px",
                  borderRadius: "6px",
                  marginTop: "8px",
                  fontFamily: "monospace",
                  fontSize: "14px",
                  border: `1px solid ${themeStyles.border}`,
                }}
              >
                <pre style={{ margin: 0, color: themeStyles.codeText }}>
                  {`fetch('/api/images?dir=my_folder', {
  headers: {
    'x-access-password': 'your_password'
  }
})
.then(response => response.json())
.then(data => console.log(data));`}
                </pre>
              </div>
            </div>

            <div>
              <Text strong style={{ color: themeStyles.text }}>
                3. 获取随机图片：
              </Text>
              <div
                style={{
                  background: themeStyles.bgCodeBlock,
                  padding: "12px",
                  borderRadius: "6px",
                  marginTop: "8px",
                  fontFamily: "monospace",
                  fontSize: "14px",
                  border: `1px solid ${themeStyles.border}`,
                }}
              >
                <pre style={{ margin: 0, color: themeStyles.codeText }}>
                  {`// 直接获取图片文件
<img src="/api/random?password=your_password" alt="随机图片" />

// 获取JSON格式的图片信息
fetch('/api/random?format=json&password=your_password')
  .then(response => response.json())
  .then(data => console.log(data));`}
                </pre>
              </div>
            </div>
            <div>
              <Text strong style={{ color: themeStyles.text }}>
                4. 上传任意文件（使用curl）：
              </Text>
              <div
                style={{
                  background: themeStyles.bgCodeBlock,
                  padding: "12px",
                  borderRadius: "6px",
                  marginTop: "8px",
                  fontFamily: "monospace",
                  fontSize: "14px",
                  border: `1px solid ${themeStyles.border}`,
                }}
              >
                <pre style={{ margin: 0, color: themeStyles.codeText }}>
                  {`curl -X POST http://localhost:3000/api/upload-file \\
  -H "x-access-password: your_password" \\
  -F "file=@/path/to/file.ext" \\
  -F "dir=my_folder" \\
  -F "filename=custom.ext"`}
                </pre>
              </div>
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default ApiDocsComponent;
