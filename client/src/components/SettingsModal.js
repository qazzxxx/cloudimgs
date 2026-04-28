import React, { useState, useEffect } from "react";
import { Modal, Slider, Button, theme } from "antd";
import { SettingOutlined } from "@ant-design/icons";

const SettingsModal = ({ open, onClose, settings, onSettingsChange }) => {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSettingsChange(draft);
      onClose();
    } catch (e) {
      console.error("Save settings error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(settings);
    onClose();
  };

  const handleRadiusChange = (val) => {
    const next = { ...draft, imageRadius: val };
    setDraft(next);
  };

  const previewColors = ["#dce8ff", "#d4f0e8", "#f0dce8"];

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      title={null}
      width={480}
      centered
      closeIcon={null}
      styles={{
        mask: {
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        },
        content: {
          padding: 0,
          borderRadius: 20,
          overflow: "hidden",
        },
        body: { padding: 0 },
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: token.colorPrimaryBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${token.colorPrimaryBorder}`,
            }}
          >
            <SettingOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: token.colorText, lineHeight: 1.2 }}>
              设置
            </div>
            <div style={{ fontSize: 12, color: token.colorTextSecondary }}>个性化图片展示效果</div>
          </div>
        </div>
        <button
          onClick={handleCancel}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: token.colorTextSecondary,
            fontSize: 20,
            lineHeight: 1,
            padding: "4px 8px",
            borderRadius: 8,
            transition: "background 0.2s, color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = token.colorBgElevated;
            e.currentTarget.style.color = token.colorText;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.color = token.colorTextSecondary;
          }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 24px" }}>
        {/* ── Image Style Section ── */}
        <div
          style={{
            background: token.colorFillAlter,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 12,
            padding: "16px 20px",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: token.colorText,
              marginBottom: 4,
              display: "block",
            }}
          >
            图片圆角
          </span>
          <span
            style={{
              fontSize: 12,
              color: token.colorTextSecondary,
              marginBottom: 12,
              display: "block",
            }}
          >
            调整图片卡片的圆角大小（0 = 直角，最大 24px）
          </span>

          {/* Live Preview */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 16,
              justifyContent: "center",
            }}
          >
            {previewColors.map((color, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 72,
                  background: color,
                  borderRadius: draft.imageRadius || 0,
                  transition: "border-radius 0.25s ease",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Slider
              min={0}
              max={24}
              step={1}
              value={draft.imageRadius || 0}
              onChange={handleRadiusChange}
              style={{ flex: 1 }}
              tooltip={{ formatter: (v) => `${v}px` }}
            />
            <div
              style={{
                minWidth: 44,
                textAlign: "center",
                fontSize: 14,
                fontWeight: 600,
                color: token.colorPrimary,
                background: token.colorPrimaryBg,
                borderRadius: 8,
                padding: "4px 8px",
                border: `1px solid ${token.colorPrimaryBorder}`,
              }}
            >
              {draft.imageRadius || 0}px
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "16px 24px",
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        <Button onClick={handleCancel} style={{ borderRadius: 10, height: 38 }}>
          取消
        </Button>
        <Button type="primary" onClick={handleSave} loading={saving} style={{ borderRadius: 10, height: 38, fontWeight: 600 }}>
          保存设置
        </Button>
      </div>
    </Modal>
  );
};

export default SettingsModal;