import React, { useState } from "react";
import { FloatButton, Modal, Tooltip, theme } from "antd";
import {
  CloudUploadOutlined,
  BgColorsOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import UploadComponent from "./UploadComponent";

const FloatingToolbar = ({
  onThemeChange,
  currentTheme,
  onRefresh,
  api,
  isMobile,
}) => {
  const [uploadVisible, setUploadVisible] = useState(false);
  const { token } = theme.useToken();

  const handleUploadSuccess = () => {
    setUploadVisible(false);
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <>
      <FloatButton.Group
        shape="circle"
        style={{
          right: 24,
          bottom: 24,
        }}
      >
        <Tooltip title="刷新列表" placement="left">
          <FloatButton icon={<ReloadOutlined />} onClick={onRefresh} />
        </Tooltip>
        
        <Tooltip title={currentTheme === "dark" ? "切换亮色" : "切换暗色"} placement="left">
          <FloatButton
            icon={<BgColorsOutlined />}
            onClick={() =>
              onThemeChange(currentTheme === "dark" ? "light" : "dark")
            }
          />
        </Tooltip>

        <Tooltip title="上传图片" placement="left">
          <FloatButton
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={() => setUploadVisible(true)}
          />
        </Tooltip>
      </FloatButton.Group>

      <Modal
        open={uploadVisible}
        title={null}
        footer={null}
        onCancel={() => setUploadVisible(false)}
        width={800}
        style={{ top: 40 }}
        styles={{
            body: {
                padding: '24px',
            }
        }}
        destroyOnClose
      >
        <UploadComponent onUploadSuccess={handleUploadSuccess} api={api} />
      </Modal>
    </>
  );
};

export default FloatingToolbar;
