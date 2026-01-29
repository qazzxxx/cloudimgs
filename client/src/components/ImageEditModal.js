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
    save: "保存",
    saveAs: "另存为",
    crop: "裁剪",
    cancel: "取消",
    apply: "应用",
    back: "返回",
    loading: "加载中...",
    resetOperations: "重置/删除全部操作",
    warning: "提示",
    confirm: "确认",
    discardChanges: "放弃更改",
    discardChangesWarningHint: "关闭后，未保存的更改将丢失。",
    changesLoseWarningHint: "重置会丢失当前更改，是否继续？",
    undoTitle: "撤销",
    redoTitle: "重做",
    showImageTitle: "显示原图",
    zoomInTitle: "放大",
    zoomOutTitle: "缩小",
    adjustTab: "调整",
    finetuneTab: "微调",
    filtersTab: "滤镜",
    watermarkTab: "水印",
    annotateTabLabel: "标注",
    resizeTab: "缩放",
    imageName: "图片名称",
    invalidImageError: "图片无效",
    uploadImageError: "上传图片失败",
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
