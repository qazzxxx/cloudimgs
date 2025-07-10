import React, { useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import {
  Card,
  Typography,
  Button,
  Upload,
  message,
  Space,
  Row,
  Col,
  Input,
  Slider,
} from "antd";
import {
  UploadOutlined,
  ScissorOutlined,
  CopyOutlined,
  RedoOutlined,
  UndoOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { Dragger } = Upload;

const ImageCropperTool = ({ api, onUploadSuccess }) => {
  const cropperRef = useRef(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [croppedImageUrl, setCroppedImageUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [fileName, setFileName] = useState("cropped-image");
  const [rotate, setRotate] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [cropData, setCropData] = useState(null);
  const [cropBoxData, setCropBoxData] = useState(null);
  const [imgData, setImgData] = useState(null);

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
      setRotate(0);
      setZoom(1);
      setTimeout(() => {
        const cropper = cropperRef.current?.cropper;
        if (cropper) {
          cropper.reset();
          cropper.clear();
          cropper.crop();
        }
      }, 100);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleCrop = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper && imageSrc) {
      const croppedDataUrl = cropper.getCroppedCanvas()?.toDataURL();
      setCroppedImageUrl(croppedDataUrl);
      setCropBoxData(cropper.getCropBoxData());
      setImgData(cropper.getData());
    }
  };

  const uploadCroppedImage = async () => {
    if (!croppedImageUrl) {
      message.error("请先裁剪图片");
      return;
    }
    setIsUploading(true);
    try {
      const res = await fetch(croppedImageUrl);
      const blob = await res.blob();
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

  const handleRotate = (angle) => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.rotate(angle);
      setRotate((prev) => prev + angle);
    }
  };

  const handleZoom = (value) => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.zoomTo(value);
      setZoom(value);
    }
  };

  return (
    <Card style={{ marginTop: 24 }}>
      <Title level={3}>
        <ScissorOutlined /> 图片裁剪工具（专业版）
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
                  <Text strong>旋转：</Text>
                  <Button
                    icon={<UndoOutlined />}
                    onClick={() => handleRotate(-90)}
                    style={{ marginRight: 8 }}
                  >
                    左转90°
                  </Button>
                  <Button
                    icon={<RedoOutlined />}
                    onClick={() => handleRotate(90)}
                  >
                    右转90°
                  </Button>
                </div>
                <div>
                  <Text strong>缩放：</Text>
                  <Slider
                    min={0.2}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={handleZoom}
                    style={{ width: "90%" }}
                  />
                </div>
              </Space>
            </Card>
          )}
        </Col>
        <Col xs={24} lg={12}>
          <Card title="裁剪与预览" size="small">
            {imageSrc && (
              <div style={{ width: "100%", minHeight: 320 }}>
                <Cropper
                  src={imageSrc}
                  style={{ height: 320, width: "100%" }}
                  initialAspectRatio={1}
                  aspectRatio={NaN} // 允许任意比例
                  guides={true}
                  ref={cropperRef}
                  viewMode={1}
                  dragMode="move"
                  background={true}
                  autoCropArea={1}
                  checkOrientation={false}
                  rotatable={true}
                  zoomTo={zoom}
                  crop={handleCrop}
                />
                {cropBoxData && imgData && (
                  <div
                    style={{
                      marginTop: 8,
                      background: "#222",
                      color: "#fff",
                      padding: "4px 8px",
                      borderRadius: 4,
                      fontSize: 14,
                      display: "inline-block",
                    }}
                  >
                    裁剪区域: {Math.round(imgData.width)} ×{" "}
                    {Math.round(imgData.height)} px
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
