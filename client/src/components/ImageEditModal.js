import React, { useMemo } from "react";
import { Modal, Button, theme as antdTheme } from "antd";
import FilerobotImageEditor from "react-filerobot-image-editor";

const ImageEditModal = ({
  open,
  file,
  editorSaving,
  onCancel,
  onClose,
  onOverwriteSave,
  onSaveAs,
  getEditorDefaults,
  getCurrentImgDataFnRef,
  theme,
}) => {
  const { token } = antdTheme.useToken();

  const isDarkMode = useMemo(() => {
    if (theme === "dark" || theme === true) return true;
    if (theme === "light" || theme === false) return false;
    const bg = (token?.colorBgContainer || "").toLowerCase();
    return bg === "#141414" || bg === "#000000" || bg === "#1f1f1f";
  }, [theme, token?.colorBgContainer]);

  const editorSource = useMemo(() => {
    if (!file?.url) return null;
    if (/^https?:\/\//i.test(file.url)) return file.url;
    return `${window.location.origin}${file.url}`;
  }, [file]);

  const filerobotTheme = useMemo(() => {
    const toRgba = (hex, alpha) => {
      if (typeof hex !== "string") return undefined;
      const h = hex.trim();
      if (!h.startsWith("#")) return undefined;
      const raw = h.slice(1);
      const full =
        raw.length === 3
          ? raw
            .split("")
            .map((c) => c + c)
            .join("")
          : raw;
      if (full.length !== 6) return undefined;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return undefined;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const primary = token?.colorPrimary || "#1677ff";
    const primaryActiveBg = toRgba(primary, isDarkMode ? 0.22 : 0.12) || "#ECF3FF";

    if (!isDarkMode) {
      return {
        palette: {
          "accent-primary": primary,
          "accent-primary-active": primary,
          "bg-primary-active": primaryActiveBg,
        },
        typography: { fontFamily: "Roboto, Arial" },
      };
    }

    return {
      palette: {
        "accent-primary": primary,
        "accent-primary-active": primary,
        "bg-primary": token?.colorBgContainer || "#141414",
        "bg-secondary": token?.colorBgContainer || "#141414",
        "bg-stateless": token?.colorFillSecondary || "#1f1f1f",
        "bg-hover": token?.colorBgLayout || "#1f1f1f",
        "bg-primary-active": primaryActiveBg,
        "txt-primary": token?.colorText || "rgba(255,255,255,0.85)",
        "txt-secondary": token?.colorTextSecondary || "rgba(255,255,255,0.45)",
        "icon-primary": token?.colorTextSecondary || "rgba(255,255,255,0.65)",
        "borders-secondary": token?.colorBorder || "rgba(255,255,255,0.12)",
        "borders-primary": token?.colorBorder || "rgba(255,255,255,0.12)",
        "bg-active": token?.colorBgLayout || "#1f1f1f",
        "light-shadow": "rgba(0, 0, 0, 0.6)",
      },
      typography: { fontFamily: "Roboto, Arial" },
    };
  }, [
    isDarkMode,
    token?.colorPrimary,
    token?.colorBgContainer,
    token?.colorFillSecondary,
    token?.colorText,
    token?.colorTextSecondary,
    token?.colorBorder,
  ]);


  const translations = {
    name: "名称",
    save: "保存",
    saveAs: "另存为",
    back: "返回",
    loading: "加载中...",
    resetOperations: "重置/删除全部操作",
    changesLoseWarningHint: "如果点击“重置”按钮，您的更改将丢失。是否继续？",
    discardChangesWarningHint: "如果关闭弹窗，您最后的更改将不会保存。",
    cancel: "取消",
    apply: "应用",
    warning: "警告",
    confirm: "确认",
    discardChanges: "放弃更改",
    undoTitle: "撤销上一步",
    redoTitle: "重做上一步",
    showImageTitle: "显示原图",
    zoomInTitle: "放大",
    zoomOutTitle: "缩小",
    toggleZoomMenuTitle: "切换缩放菜单",
    adjustTab: "调整",
    finetuneTab: "微调",
    filtersTab: "滤镜",
    watermarkTab: "水印",
    annotateTabLabel: "标注",
    resize: "调整大小",
    resizeTab: "调整大小",
    imageName: "图片名称",
    invalidImageError: "提供的图片无效",
    uploadImageError: "上传图片时出错",
    areNotImages: "不是图片",
    isNotImage: "不是图片",
    toBeUploaded: "待上传",
    cropTool: "裁剪",
    original: "原图",
    custom: "自定义",
    square: "方形",
    landscape: "风景",
    portrait: "人像",
    ellipse: "椭圆",
    classicTv: "传统电视",
    cinemascope: "宽银幕",
    arrowTool: "箭头",
    blurTool: "模糊",
    brightnessTool: "亮度",
    contrastTool: "对比度",
    ellipseTool: "椭圆",
    unFlipX: "取消水平翻转",
    flipX: "水平翻转",
    unFlipY: "取消垂直翻转",
    flipY: "垂直翻转",
    hsvTool: "HSV",
    hue: "色相",
    brightness: "亮度",
    saturation: "饱和度",
    value: "明度",
    imageTool: "图片",
    importing: "导入中...",
    addImage: "+ 添加图片",
    uploadImage: "上传图片",
    fromGallery: "从图库",
    lineTool: "直线",
    penTool: "画笔",
    polygonTool: "多边形",
    sides: "边数",
    rectangleTool: "矩形",
    cornerRadius: "圆角半径",
    resizeWidthTitle: "宽度(像素)",
    resizeHeightTitle: "高度(像素)",
    toggleRatioLockTitle: "锁定/解锁比例",
    resetSize: "重置为原始大小",
    rotateTool: "旋转",
    textTool: "文字",
    textSpacings: "文字间距",
    textAlignment: "文字对齐",
    fontFamily: "字体",
    size: "大小",
    letterSpacing: "字间距",
    lineHeight: "行高",
    warmthTool: "色温",
    addWatermark: "+ 添加水印",
    addTextWatermark: "+ 添加文字水印",
    addWatermarkTitle: "选择水印类型",
    uploadWatermark: "上传水印",
    addWatermarkAsText: "添加为文字",
    padding: "内边距",
    paddings: "内边距",
    shadow: "阴影",
    horizontal: "水平",
    vertical: "垂直",
    blur: "模糊",
    opacity: "不透明度",
    transparency: "透明度",
    position: "位置",
    stroke: "描边",
    saveAsModalTitle: "另存为",
    extension: "扩展名",
    format: "格式",
    nameIsRequired: "名称是必填项。",
    quality: "质量",
    imageDimensionsHoverTitle: "保存的图片尺寸 (宽 x 高)",
    cropSizeLowerThanResizedWarning: "注意：选定的裁剪区域小于应用的调整大小，这可能会导致质量下降",
    actualSize: "实际大小 (100%)",
    fitSize: "适应屏幕",
    addImageTitle: "选择要添加的图片...",
    mutualizedFailedToLoadImg: "加载图片失败",
    tabsMenu: "菜单",
    download: "下载",
    width: "宽度",
    height: "高度",
    plus: "+",
    cropItemNoEffect: "此裁剪项无预览可用"
  };

  return (
    <Modal
      open={open}
      footer={null}
      onCancel={onCancel}
      width="100vw"
      style={{ top: 0, margin: 0, maxWidth: "100vw", padding: 0 }}
      styles={{
        body: { padding: 0, height: "100vh", overflow: "hidden" },
        content: { padding: 0 },
        container: { padding: 0 },
      }}
      closeIcon={null}
      destroyOnClose
    >
      {editorSource && file && (
        <div style={{ height: "100vh", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 16,
              top: 16,
              zIndex: 1000,
              display: "flex",
              flexDirection: "row",
              gap: 12,
              pointerEvents: "auto",
            }}
          >
            <Button
              type="primary"
              disabled={editorSaving}
              loading={editorSaving}
              onClick={onOverwriteSave}
            >
              覆盖保存
            </Button>
            <Button disabled={editorSaving} onClick={onSaveAs}>
              另存为上传
            </Button>
          </div>
          <FilerobotImageEditor
            source={editorSource}
            onClose={onClose}
            closeAfterSave={false}
            language="zh"
            translations={translations}
            defaultSavedImageName={getEditorDefaults(file).baseName}
            defaultSavedImageType={getEditorDefaults(file).type}
            defaultSavedImageQuality={92}
            savingPixelRatio={2}
            previewPixelRatio={1}
            getCurrentImgDataFnRef={getCurrentImgDataFnRef}
            removeSaveButton={true}
            theme={filerobotTheme}
          />
        </div>
      )}
    </Modal>
  );
};

export default ImageEditModal;
