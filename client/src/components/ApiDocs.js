import React from 'react';
import { Typography, Card, Collapse, Tag, Divider, theme, Button, message, Tooltip } from 'antd';
import {
  FileImageOutlined, 
  FolderOutlined, 
  InfoCircleOutlined,
  CopyOutlined,
  CodeOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { getPassword } from "../utils/secureStorage";

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

const ApiDocs = () => {
  const { token } = theme.useToken();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const savedPassword = typeof window !== "undefined" ? (getPassword() || "") : "";

  const containerStyle = {
    maxWidth: 900,
    margin: '0 auto',
    padding: '40px 20px',
  };

  const endpointStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    flexWrap: 'wrap'
  };

  const methodTagStyle = (method) => {
    return { minWidth: 60, textAlign: 'center', fontWeight: 'bold' };
  };

  const copyText = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => message.success("已复制 CURL 命令"))
        .catch(() => message.error("复制失败"));
      return;
    }
    // Fallback
    const input = document.createElement("input");
    input.style.position = "fixed";
    input.style.top = "-10000px";
    document.body.appendChild(input);
    input.value = text;
    input.focus();
    input.select();
    try {
      document.execCommand("copy");
      message.success("已复制 CURL 命令");
    } catch (e) {
      message.error("复制失败");
    } finally {
      document.body.removeChild(input);
    }
  };

  const buildCurl = (endpoint, method = 'GET', options = {}) => {
    const fullUrl = `${origin}${endpoint}`;
    const pwdHeader = savedPassword ? ` -H "X-Access-Password: ${savedPassword}"` : "";
    let cmd = `curl -X ${method} "${fullUrl}"${pwdHeader}`;

    if (method === 'POST') {
        if (options.isMultipart) {
             cmd += ` \\\n  -F "${options.fileParam || 'image'}=@/path/to/file"`;
             if (options.extraParams) {
                 options.extraParams.forEach(p => {
                     cmd += ` \\\n  -F "${p.key}=${p.value}"`;
                 });
             }
        } else if (options.isJson) {
            cmd += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(options.body)}'`;
        }
    }
    
    return cmd;
  };

  const CurlButton = ({ endpoint, method, options }) => (
      <Tooltip title="复制 CURL 命令">
        <Button 
            size="small" 
            icon={<CopyOutlined />} 
            onClick={(e) => {
                e.stopPropagation();
                copyText(buildCurl(endpoint, method, options));
            }}
        >
            CURL
        </Button>
      </Tooltip>
  );

  return (
    <div style={containerStyle}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Title level={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <img 
            src="/favicon.svg" 
            alt="Logo" 
            style={{ 
                width: 48, 
                height: 48, 
                objectFit: 'contain',
                filter: theme.useToken().token.colorBgContainer === '#141414' ? 'brightness(1.2)' : 'none'
            }} 
          />
          云图 - 开放接口文档
        </Title>
        <Paragraph type="secondary" style={{ fontSize: 16 }}>
          云图提供了一系列 RESTful API，方便您进行图片的上传、管理与检索。
        </Paragraph>
        {savedPassword && (
            <Tag color="success" icon={<CodeOutlined />}>
                已自动在 CURL 示例中包含您的访问密码
            </Tag>
        )}
      </div>

      <Collapse defaultActiveKey={['1', '2', '3']} size="large">
        <Panel 
            header={<div style={{ fontWeight: 600, fontSize: 16 }}>图片管理 (Images)</div>} 
            key="1"
            extra={<FileImageOutlined />}
        >
          <Card type="inner" title="获取图片列表" bordered={false}>
            <div style={endpointStyle}>
              <Tag color="blue" style={methodTagStyle('GET')}>GET</Tag>
              <Text code copyable>/api/images</Text>
              <CurlButton endpoint="/api/images?page=1&pageSize=20" method="GET" />
            </div>
            <Paragraph>
              分页获取图片列表，支持按目录筛选和关键词搜索。
            </Paragraph>
            <Divider orientation="left" plain>参数</Divider>
            <ul>
                <li><Text code>page</Text>: 页码 (默认 1)</li>
                <li><Text code>pageSize</Text>: 每页数量 (默认 50)</li>
                <li><Text code>dir</Text>: 目录路径 (可选)</li>
                <li><Text code>search</Text>: 搜索关键词 (可选)</li>
            </ul>
          </Card>
          
          <Divider />

          <Card type="inner" title="上传图片" bordered={false}>
             <div style={endpointStyle}>
              <Tag color="green" style={methodTagStyle('POST')}>POST</Tag>
              <Text code copyable>/api/upload</Text>
              <CurlButton 
                endpoint="/api/upload" 
                method="POST" 
                options={{ isMultipart: true, extraParams: [{key: 'dir', value: 'uploads'}] }} 
              />
            </div>
            <Paragraph>
              上传单张或多张图片到指定目录。
            </Paragraph>
             <Divider orientation="left" plain>Body (FormData)</Divider>
            <ul>
                <li><Text code>image</Text>: 图片文件 (支持多文件)</li>
                <li><Text code>dir</Text>: 目标目录 (可选，默认为根目录)</li>
            </ul>
          </Card>

           <Divider />

           <Card type="inner" title="获取随机图片" bordered={false}>
            <div style={endpointStyle}>
              <Tag color="blue" style={methodTagStyle('GET')}>GET</Tag>
              <Text code copyable>/api/random</Text>
              <CurlButton endpoint="/api/random?format=json" method="GET" />
            </div>
            <Paragraph>
              随机获取一张图片。
            </Paragraph>
            <Divider orientation="left" plain>参数</Divider>
            <ul>
                <li><Text code>dir</Text>: 目录路径 (可选)</li>
                <li><Text code>format</Text>: 返回格式，<Text code>json</Text> 返回元数据，否则直接返回图片流</li>
            </ul>
          </Card>

           <Divider />

           <Card type="inner" title="删除图片" bordered={false}>
             <div style={endpointStyle}>
              <Tag color="red" style={methodTagStyle('DELETE')}>DELETE</Tag>
              <Text code copyable>/api/images/:path</Text>
               <CurlButton endpoint="/api/images/example.jpg" method="DELETE" />
            </div>
            <Paragraph>
              删除指定路径的图片。
            </Paragraph>
          </Card>
        </Panel>

        <Panel 
            header={<div style={{ fontWeight: 600, fontSize: 16 }}>文件操作 (Files)</div>} 
            key="2"
            extra={<FileTextOutlined />}
        >
             <Card type="inner" title="上传任意文件" bordered={false}>
             <div style={endpointStyle}>
              <Tag color="green" style={methodTagStyle('POST')}>POST</Tag>
              <Text code copyable>/api/upload-file</Text>
              <CurlButton 
                endpoint="/api/upload-file" 
                method="POST" 
                options={{ 
                    isMultipart: true, 
                    fileParam: 'file',
                    extraParams: [{key: 'dir', value: 'files'}, {key: 'filename', value: 'custom.ext'}] 
                }} 
              />
            </div>
            <Paragraph>
              上传任意类型文件，支持自动解析音视频时长。
            </Paragraph>
             <Divider orientation="left" plain>Body (FormData)</Divider>
            <ul>
                <li><Text code>file</Text>: 文件对象</li>
                <li><Text code>dir</Text>: 目标目录</li>
                <li><Text code>filename</Text>: 自定义文件名 (可选)</li>
            </ul>
          </Card>
        </Panel>

        <Panel 
            header={<div style={{ fontWeight: 600, fontSize: 16 }}>目录管理 (Directories)</div>} 
            key="3"
            extra={<FolderOutlined />}
        >
           <Card type="inner" title="获取目录列表" bordered={false}>
            <div style={endpointStyle}>
              <Tag color="blue" style={methodTagStyle('GET')}>GET</Tag>
              <Text code copyable>/api/dirs</Text>
              <CurlButton endpoint="/api/dirs" method="GET" />
            </div>
            <Paragraph>
              获取当前所有的图片目录结构。
            </Paragraph>
          </Card>
        </Panel>

        <Panel 
            header={<div style={{ fontWeight: 600, fontSize: 16 }}>系统信息 (System)</div>} 
            key="4"
            extra={<InfoCircleOutlined />}
        >
           <Card type="inner" title="获取存储状态" bordered={false}>
            <div style={endpointStyle}>
              <Tag color="blue" style={methodTagStyle('GET')}>GET</Tag>
              <Text code copyable>/api/stats</Text>
              <CurlButton endpoint="/api/stats" method="GET" />
            </div>
            <Paragraph>
              获取服务器存储空间使用情况及图片总数统计。
            </Paragraph>
          </Card>
        </Panel>
      </Collapse>
      
      <div style={{ marginTop: 40, textAlign: 'center', color: token.colorTextSecondary }}>
        <Text type="secondary">© 2025 Cloud Gallery API. All rights reserved.</Text>
      </div>
    </div>
  );
};

export default ApiDocs;
