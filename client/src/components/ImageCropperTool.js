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
          // 获取画布数据并设置裁剪框为整张图片
          const canvasData = cropper.getCanvasData();
          cropper.setCropBoxData({
            left: canvasData.left,
            top: canvasData.top,
            width: canvasData.width,
            height: canvasData.height,
          });
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
        <ScissorOutlined /> 图片裁剪
      </Title>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={24}>
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
        </Col>
      </Row>
      {/* 裁剪与预览区域 */}
      {imageSrc && (
        <>
          <Row gutter={[24, 24]} style={{ marginTop: 0 }}>
            <Col span={24}>
              <Card title="裁剪与预览" size="small">
                <div
                  style={{
                    display: "flex",
                    gap: 32,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  {/* 左侧裁剪区 */}
                  <div style={{ minWidth: 320, flex: 1 }}>
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
                  {/* 右侧预览区 */}
                  <div
                    style={{
                      minWidth: 220,
                      maxWidth: 320,
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontWeight: 500, marginBottom: 8 }}>
                      裁剪后预览
                    </div>
                    {croppedImageUrl ? (
                      <img
                        src={croppedImageUrl}
                        alt="裁剪后图片"
                        style={{
                          maxWidth: "100%",
                          maxHeight: 200,
                          border: "1px solid #eee",
                          borderRadius: 4,
                          background: "#fafafa",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          color: "#aaa",
                          height: 200,
                          lineHeight: "200px",
                          border: "1px dashed #eee",
                          borderRadius: 4,
                        }}
                      >
                        暂无预览
                      </div>
                    )}
                    <Button
                      type="primary"
                      style={{ marginTop: 12, width: "100%" }}
                      loading={isUploading}
                      onClick={uploadCroppedImage}
                      disabled={!croppedImageUrl}
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
                </div>
              </Card>
            </Col>
          </Row>
          {/* 工具栏区域 */}
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card size="small" bodyStyle={{ padding: 12 }}>
                <Space size="large" align="center">
                  <span style={{ fontWeight: 500 }}>工具栏：</span>
                  <Button
                    icon={<UndoOutlined />}
                    onClick={() => handleRotate(-90)}
                  >
                    左转90°
                  </Button>
                  <Button
                    icon={<RedoOutlined />}
                    onClick={() => handleRotate(90)}
                  >
                    右转90°
                  </Button>
                  <span style={{ marginLeft: 16 }}>缩放：</span>
                  <Slider
                    min={0.2}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={handleZoom}
                    style={{ width: 180, display: "inline-block" }}
                  />
                </Space>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Card>
  );
};

export default ImageCropperTool;
