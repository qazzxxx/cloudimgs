import React, { useState, useEffect } from "react";
import {
  Upload,
  Button,
  message,
  Card,
  Typography,
  Space,
  Tag,
  Progress,
  Row,
  Col,
  theme,
  Grid,
  Tabs,
  Input,
} from "antd";
import { InboxOutlined, CheckCircleOutlined, CloseOutlined, CopyOutlined } from "@ant-design/icons";
import DirectorySelector from "./DirectorySelector";

const { Dragger } = Upload;
const { Title, Text } = Typography;

function sanitizeDir(input) {
  let dir = (input || "").trim().replace(/\\+/g, "/").replace(/\/+/g, "/");
  dir = dir.replace(/\/+$/, ""); // 去除末尾斜杠
  dir = dir.replace(/^\/+/, ""); // 去除开头斜杠
  dir = dir.replace(/\/+/, "/"); // 合并多余斜杠
  return dir;
}

const UploadComponent = ({ onUploadSuccess, api, isModal }) => {
  const {
    token: { colorBgContainer, colorBorder },
  } = theme.useToken();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isDarkMode = theme.useToken().theme?.id === 1 || colorBgContainer === "#141414" || colorBgContainer === "#000000" || colorBgContainer === "#1f1f1f";
  
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  // Separate list for currently completed session uploads to show in overlay
  const [sessionUploadedFiles, setSessionUploadedFiles] = useState([]); 
  const [dir, setDir] = useState("");
  const [config, setConfig] = useState({
    allowedExtensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
      ".svg",
    ],
    maxFileSize: 10 * 1024 * 1024,
    maxFileSizeMB: 10,
    allowedFormats: "JPG, JPEG, PNG, GIF, WEBP, BMP, SVG",
  });

  const uploading = uploadQueue.some(item => item.status === 'pending' || item.status === 'uploading');

  // 获取配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get("/config");
        if (response.data.success) {
          setConfig(response.data.data.upload);
        }
      } catch (error) {
        console.warn("获取配置失败，使用默认配置:", error);
      }
    };
    fetchConfig();
  }, [api]);

  const updateQueueItem = (uid, updates) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.uid === uid ? { ...item, ...updates } : item))
    );
  };

  // 处理粘贴事件
  const handlePaste = async (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        // Clear previous queue for new paste action
        setUploadQueue([]);
        setSessionUploadedFiles([]);

        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await handlePastedImage(file);
        }
        break;
      }
    }
  };

  // 处理粘贴的图片
  const handlePastedImage = async (file) => {
    // 验证文件类型
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("只能上传图片文件！");
      return;
    }

    // 验证文件大小
    const isLtMax = file.size <= config.maxFileSize;
    if (!isLtMax) {
      message.error(`图片大小不能超过${config.maxFileSizeMB}MB！`);
      return;
    }

    // 生成文件名
    const timestamp = new Date().getTime();
    const extension = file.type.split("/")[1] || "png";
    const fileName = `pasted-image-${timestamp}.${extension}`;

    // 创建新的File对象，设置文件名
    const renamedFile = new File([file], fileName, { type: file.type });
    // 添加uid
    renamedFile.uid = `pasted-${timestamp}`;

    // 添加到队列
    setUploadQueue(prev => [...prev, { uid: renamedFile.uid, name: fileName, progress: 0, status: 'pending' }]);

    // 上传文件
    try {
        await uploadFile(renamedFile, (progress) => {
             updateQueueItem(renamedFile.uid, { progress, status: 'uploading' });
        });
        updateQueueItem(renamedFile.uid, { progress: 100, status: 'success' });
    } catch (error) {
        updateQueueItem(renamedFile.uid, { status: 'error', errorMsg: error.message });
    }
  };

  // 上传文件的通用方法
  const uploadFile = async (file, onProgress) => {
    let safeDir = sanitizeDir(dir);
    if (safeDir.includes("..")) {
        throw new Error("目录不能包含 .. 等非法字符");
    }

    const formData = new FormData();

    // 确保文件名编码正确，特别是中文文件名
    const fileName = file.name;
    formData.append("image", file, fileName);

    const url = safeDir
      ? `/upload?dir=${encodeURIComponent(safeDir)}`
      : "/upload";

    try {
      const response = await api.post(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          if (onProgress) onProgress(percentCompleted);
        },
      });

      if (response.data.success) {
        const fileData = response.data.data;
        setUploadedFiles((prev) => [...prev, fileData]);
        // Add to session uploaded files for the result view
        setSessionUploadedFiles(prev => [...prev, fileData]);
        message.success(`${fileName} 上传成功！`);
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        throw new Error(response.data.error || "上传失败");
      }
    } catch (error) {
      const msg = error?.response?.data?.error || error.message || "上传失败";
      message.error(msg);
      throw new Error(msg);
    }
  };

  // 添加全局粘贴事件监听
  useEffect(() => {
    const handleGlobalPaste = (event) => {
      // 检查是否在输入框中，如果是则不处理粘贴
      const target = event.target;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      handlePaste(event);
    };

    document.addEventListener("paste", handleGlobalPaste);

    return () => {
      document.removeEventListener("paste", handleGlobalPaste);
    };
  }, [dir, config, api, onUploadSuccess]);

  const uploadProps = {
    name: "image",
    multiple: true,
    accept: config.allowedExtensions
      .map((ext) => `image/${ext.replace(".", "")}`)
      .join(","),
    beforeUpload: (file) => {
      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        message.error("只能上传图片文件！");
        return false;
      }
      const isLtMax = file.size <= config.maxFileSize;
      if (!isLtMax) {
        message.error(`图片大小不能超过${config.maxFileSizeMB}MB！`);
        return false;
      }
      return true;
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      const uid = file.uid;
      setUploadQueue(prev => [...prev, { uid, name: file.name, progress: 0, status: 'pending' }]);
      
      try {
        await uploadFile(file, (progress) => {
             updateQueueItem(uid, { progress, status: 'uploading' });
        });
        updateQueueItem(uid, { progress: 100, status: 'success' });
        onSuccess();
      } catch (error) {
        updateQueueItem(uid, { status: 'error', errorMsg: error.message });
        onError(error);
      }
    },
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => message.success("链接已复制到剪贴板"))
        .catch(() => message.error("复制失败"));
      return;
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
        message.success("链接已复制到剪贴板");
      }
    } catch (e) {
      document.body.removeChild(input);
      message.error("当前浏览器不支持复制功能");
    }
  };

  const generateLinks = (type) => {
      return sessionUploadedFiles.map(file => {
          const fullUrl = `${window.location.origin}${file.url}`;
          switch (type) {
              case 'markdown':
                  return `![${file.originalName}](${fullUrl})`;
              case 'html':
                  return `<img src="${fullUrl}" alt="${file.originalName}" />`;
              case 'url':
              default:
                  return fullUrl;
          }
      }).join('\n');
  };

  const UploadResult = () => {
      const [activeTab, setActiveTab] = useState('url');
      const content = generateLinks(activeTab);

      const items = [
          { key: 'url', label: 'URL' },
          { key: 'markdown', label: 'Markdown' },
          { key: 'html', label: 'HTML' },
      ];

      return (
          <div style={{ marginTop: 16, background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', padding: 12, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Tabs 
                      activeKey={activeTab} 
                      onChange={setActiveTab} 
                      items={items} 
                      size="small" 
                      style={{ marginBottom: 0 }}
                      tabBarStyle={{ marginBottom: 0, borderBottom: 'none' }}
                  />
                  <Button 
                      type="primary" 
                      size="small" 
                      icon={<CopyOutlined />} 
                      onClick={() => copyToClipboard(content)}
                  >
                      一键复制
                  </Button>
              </div>
              <Input.TextArea 
                  value={content} 
                  autoSize={{ minRows: 3, maxRows: 6 }} 
                  readOnly 
                  style={{ 
                      fontFamily: 'monospace', 
                      fontSize: 12, 
                      background: isDarkMode ? '#141414' : '#fff',
                      color: isDarkMode ? 'rgba(255,255,255,0.85)' : undefined
                  }} 
              />
          </div>
      );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div style={{ padding: isModal ? '24px' : 0 }}>
      <Title 
        level={isMobile ? 4 : 3} 
        style={{ 
            marginTop: 0, 
            marginBottom: 16, 
            textAlign: isModal ? 'center' : 'left',
            color: isModal && !isDarkMode ? 'rgba(0,0,0,0.85)' : isModal ? '#fff' : undefined 
        }}
      >
          上传图片
      </Title>

      <Space
        direction="vertical"
        style={{ width: "100%", marginBottom: isMobile ? 12 : 16 }}
        size={isMobile ? "small" : "middle"}
      >
        <DirectorySelector
          value={dir}
          onChange={setDir}
          placeholder="选择或输入子目录（可选）"
          api={api}
          style={{ 
              background: isModal ? (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : undefined,
              color: isModal && !isDarkMode ? 'rgba(0,0,0,0.85)' : undefined
          }}
        />
      </Space>

      <Card 
        style={{ 
            marginBottom: isMobile ? 16 : 24, 
            background: isModal ? (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.4)') : undefined,
            border: isModal ? (isDarkMode ? '1px dashed rgba(255,255,255,0.2)' : '1px dashed rgba(0,0,0,0.2)') : undefined
        }}
        bordered={!isModal}
        styles={{ body: { padding: isModal ? '16px' : '24px' } }}
      >
        <Dragger {...uploadProps} disabled={uploading} style={{ background: 'transparent', border: 'none' }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: isModal ? (isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)') : undefined }} />
          </p>
          <p className="ant-upload-text" style={{ color: isModal ? (isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)') : undefined, fontSize: 14 }}>
              点击或拖拽图片到此区域
          </p>
          <p
            style={{
              fontSize: isMobile ? "11px" : "12px",
              color: isModal ? (isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)") : "#999",
              marginTop: "8px",
              marginBottom: "0",
            }}
          >
            支持 {config.allowedFormats} 格式，最大 {config.maxFileSizeMB}MB
          </p>
        </Dragger>
      </Card>

      {/* Full Page Upload Overlay */}
      {uploadQueue.length > 0 && (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            zIndex: 1005, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                width: '100%', maxWidth: '600px', 
                background: isDarkMode ? '#1f1f1f' : '#fff',
                borderRadius: '12px', padding: '24px', 
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                maxHeight: '80vh', display: 'flex', flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0, color: isDarkMode ? '#fff' : undefined }}>
                        正在上传 ({uploadQueue.filter(i => i.status === 'success').length}/{uploadQueue.length})
                    </Title>
                    <Button 
                        type="text" 
                        icon={<CloseOutlined style={{ color: isDarkMode ? 'rgba(255,255,255,0.45)' : undefined }} />} 
                        onClick={() => {
                            setUploadQueue([]);
                            setSessionUploadedFiles([]);
                        }} 
                    />
                </div>
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
                    {uploadQueue.map(item => (
                        <div key={item.uid} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text ellipsis style={{ maxWidth: '70%', color: isDarkMode ? '#fff' : undefined }}>{item.name}</Text>
                                <Text type="secondary" style={{ color: isDarkMode ? 'rgba(255,255,255,0.45)' : undefined }}>
                                    {item.status === 'error' ? '失败' : item.status === 'success' ? '完成' : `${item.progress}%`}
                                </Text>
                            </div>
                            <Progress 
                                percent={item.progress} 
                                status={item.status === 'error' ? 'exception' : item.status === 'success' ? 'success' : 'active'} 
                                showInfo={false}
                                size="small"
                                strokeColor={item.status === 'success' ? '#52c41a' : undefined}
                            />
                            {item.errorMsg && <Text type="danger" style={{ fontSize: 12 }}>{item.errorMsg}</Text>}
                        </div>
                    ))}
                </div>
                {!uploading && (
                    <>
                        {sessionUploadedFiles.length > 0 && <UploadResult />}
                        <div style={{ textAlign: 'center', marginTop: '16px' }}>
                            <Button type="primary" onClick={() => {
                                setUploadQueue([]);
                                setSessionUploadedFiles([]);
                            }}>
                                关闭
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <Card title="最近上传" style={{ marginTop: isMobile ? 16 : 24 }}>
          <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
            {uploadedFiles
              .slice(-6)
              .reverse()
              .map((file, index) => (
                <Col xs={24} sm={12} md={8} lg={6} key={index}>
                  <Card
                    size="small"
                    hoverable
                    cover={
                      <img
                        alt={file.originalName}
                        src={file.url}
                        style={{
                          height: isMobile ? 100 : 120,
                          objectFit: "cover",
                        }}
                      />
                    }
                    actions={[
                      <Button
                        type="text"
                        icon={<CheckCircleOutlined />}
                        size={isMobile ? "small" : "middle"}
                        onClick={() =>
                          copyToClipboard(
                            `${window.location.origin}${file.url}`
                          )
                        }
                      >
                        {isMobile ? "复制" : "复制链接"}
                      </Button>,
                    ]}
                  >
                    <Card.Meta
                      title={
                        <Text ellipsis style={{ maxWidth: "100%" }}>
                          {file.originalName}
                        </Text>
                      }
                      description={
                        <Space direction="vertical" size="small">
                          <Text
                            type="secondary"
                            style={{ fontSize: isMobile ? "11px" : "12px" }}
                          >
                            {formatFileSize(file.size)}
                          </Text>
                          <Tag
                            color="blue"
                            style={{ fontSize: isMobile ? "11px" : "12px" }}
                          >
                            {file.mimetype}
                          </Tag>
                        </Space>
                      }
                    />
                  </Card>
                </Col>
              ))}
          </Row>
        </Card>
      )}
    </div>
  );
};

export default UploadComponent;