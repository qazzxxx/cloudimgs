import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import {
  Card,
  Typography,
  Button,
  Slider,
  Upload,
  message,
  Space,
  Row,
  Col,
  Input,
} from "antd";
import {
  UploadOutlined,
  ScissorOutlined,
  CopyOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { Dragger } = Upload;

function getCroppedImg(imageSrc, crop, zoom, aspect, croppedAreaPixels) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      }, "image/png");
    };
    image.onerror = (e) => reject(e);
  });
}

const ImageCropperTool = ({ api, onUploadSuccess }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [fileName, setFileName] = useState("cropped-image");

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleImageUpload = (file) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("只能上传图片文件！");
      return false;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target.result);
      setCroppedImageUrl(null);
      setUploadedUrl("");
      setFileName(file.name.replace(/\.[^/.]+$/, ""));
    };
    reader.readAsDataURL(file);
    return false;
  };

  const showCroppedImage = useCallback(async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) {
        message.error("请先上传图片并裁剪");
        return;
      }
      const blob = await getCroppedImg(
        imageSrc,
        crop,
        zoom,
        aspect,
        croppedAreaPixels
      );
      const croppedUrl = URL.createObjectURL(blob);
      setCroppedImageUrl(croppedUrl);
      message.success("裁剪成功！");
    } catch (e) {
      message.error("裁剪失败");
    }
  }, [imageSrc, crop, zoom, aspect, croppedAreaPixels]);

  const uploadCroppedImage = async () => {
    if (!croppedImageUrl) {
      message.error("请先裁剪图片");
      return;
    }
    setIsUploading(true);
    try {
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append("image", blob, fileName + ".png");
      const uploadResponse = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (uploadResponse.data.success) {
        const imageUrl = `${window.location.origin}${uploadResponse.data.data.url}`;
        setUploadedUrl(imageUrl);
        message.success("图片上传成功！");
        if (onUploadSuccess) onUploadSuccess();
      } else {
        message.error(uploadResponse.data.error || "上传失败");
      }
    } catch (error) {
      message.error("上传失败，请重试");
    } finally {
      setIsUploading(false);
    }
  };

  const copyUploadedUrl = () => {
    if (!uploadedUrl) {
      message.error("没有可复制的URL");
      return;
    }
    navigator.clipboard.writeText(uploadedUrl).then(() => {
      message.success("URL已复制到剪贴板");
    });
  };

  return (
    <Card style={{ marginTop: 24 }}>
      <Title level={3}>
        <ScissorOutlined /> 图片裁剪工具
      </Title>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="图片上传" size="small" style={{ marginBottom: 16 }}>
            <Dragger
              accept="image/*"
              beforeUpload={handleImageUpload}
              showUploadList={false}
            >
              {imageSrc ? (
                <div style={{ textAlign: "center" }}>
                  <img
                    src={imageSrc}
                    alt="原始图片"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "200px",
                      border: "1px solid #eee",
                      borderRadius: 4,
                    }}
                  />
                </div>
              ) : (
                <div>
                  <UploadOutlined style={{ fontSize: 48, color: "#999" }} />
                  <p>点击或拖拽图片到此区域上传</p>
                </div>
              )}
            </Dragger>
          </Card>
          {imageSrc && (
            <Card title="裁剪参数" size="small">
              <Space
                direction="vertical"
                style={{ width: "100%" }}
                size="middle"
              >
                <div>
                  <Text strong>缩放：</Text>
                  <Slider
                    min={0.2}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={setZoom}
                    style={{ width: "90%" }}
                  />
                </div>
                <div>
                  <Text strong>宽高比：</Text>
                  <Input
                    value={aspect}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*\.?\d*$/.test(val)) setAspect(val);
                    }}
                    onBlur={(e) => {
                      let val = parseFloat(aspect);
                      if (!val || val <= 0) val = 1;
                      setAspect(val);
                    }}
                    addonAfter=":1"
                    style={{ width: 120 }}
                    inputMode="decimal"
                  />
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    1=正方形，1.777=16:9，0.75=3:4
                  </Text>
                </div>
                <Button
                  type="primary"
                  onClick={showCroppedImage}
                  icon={<ScissorOutlined />}
                  block
                >
                  裁剪图片
                </Button>
              </Space>
            </Card>
          )}
        </Col>
        <Col xs={24} lg={12}>
          <Card title="裁剪预览" size="small">
            {imageSrc && (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 300,
                  background: "#222",
                }}
              >
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={parseFloat(aspect) || 1}
                  minZoom={0.2}
                  maxZoom={3}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  style={{ containerStyle: { borderRadius: 8 } }}
                />
                {croppedAreaPixels && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      left: 8,
                      background: "rgba(0,0,0,0.6)",
                      color: "#fff",
                      padding: "4px 8px",
                      borderRadius: 4,
                      fontSize: 14,
                    }}
                  >
                    裁剪区域: {croppedAreaPixels.width} ×{" "}
                    {croppedAreaPixels.height} px
                  </div>
                )}
              </div>
            )}
            {croppedImageUrl && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <img
                  src={croppedImageUrl}
                  alt="裁剪后图片"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 200,
                    border: "1px solid #eee",
                    borderRadius: 4,
                  }}
                />
                <Button
                  type="primary"
                  style={{ marginTop: 12 }}
                  loading={isUploading}
                  onClick={uploadCroppedImage}
                  block
                >
                  上传到图床
                </Button>
                {uploadedUrl && (
                  <div style={{ marginTop: 8 }}>
                    <Input
                      value={uploadedUrl}
                      readOnly
                      style={{ width: "80%" }}
                    />
                    <Button
                      icon={<CopyOutlined />}
                      onClick={copyUploadedUrl}
                      style={{ marginLeft: 8 }}
                    >
                      复制URL
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default ImageCropperTool;
