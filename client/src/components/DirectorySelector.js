import React, { useState, useEffect } from "react";
import { Select, Input, Space, Typography, Divider } from "antd";
import { FolderOutlined, PlusOutlined } from "@ant-design/icons";

const { Option } = Select;
const { Text } = Typography;

const DirectorySelector = ({
  value,
  onChange,
  placeholder = "选择或输入子目录",
  style = {},
  allowClear = true,
  showSearch = true,
  size = "middle",
  allowInput = true,
  api,
}) => {
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [isInputMode, setIsInputMode] = useState(false);

  // 获取目录列表
  const fetchDirectories = async () => {
    setLoading(true);
    try {
      const response = await api.get("/directories");
      if (response.data.success) {
        setDirectories(response.data.data);
      }
    } catch (error) {
      console.error("获取目录列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectories();
  }, []);

  // 当value改变时，同步inputValue
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const handleSelectChange = (selectedValue) => {
    setInputValue(selectedValue || "");
    setShowInput(false);
    setIsInputMode(false);
    if (onChange) {
      onChange(selectedValue);
    }
  };

  const handleInputChange = (e) => {
    const inputVal = e.target.value;
    setInputValue(inputVal);
    if (onChange) {
      onChange(inputVal);
    }
  };

  const handleInputConfirm = () => {
    if (inputValue.trim()) {
      if (onChange) {
        onChange(inputValue.trim());
      }
    }
    setShowInput(false);
    setIsInputMode(false);
  };

  const handleInputBlur = () => {
    // 延迟处理，避免与点击事件冲突
    setTimeout(() => {
      handleInputConfirm();
    }, 200);
  };

  const handleInputKeyPress = (e) => {
    if (e.key === "Enter") {
      handleInputConfirm();
    }
  };

  const handleSearch = (searchValue) => {
    // 搜索功能已通过filterOption实现
  };

  const handleDropdownVisibleChange = (open) => {
    if (!open && !isInputMode) {
      setShowInput(false);
    }
  };

  const handleInputNewDirectory = () => {
    setIsInputMode(true);
    setShowInput(true);
    setInputValue(""); // 清空输入值，准备输入新目录
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Select
        placeholder={placeholder}
        value={value}
        onChange={handleSelectChange}
        style={{ width: "100%", ...style }}
        allowClear={allowClear}
        showSearch={showSearch}
        size={size}
        loading={loading}
        onSearch={handleSearch}
        onDropdownVisibleChange={handleDropdownVisibleChange}
        filterOption={(input, option) => {
          if (!input) return true;
          const optionText =
            option?.children?.props?.children?.[1]?.props?.children || "";
          return optionText.toLowerCase().indexOf(input.toLowerCase()) >= 0;
        }}
        notFoundContent={loading ? "加载中..." : "暂无目录"}
        dropdownRender={(menu) => (
          <div>
            {menu}
            {allowInput && (
              <>
                <Divider style={{ margin: "8px 0" }} />
                <div
                  style={{
                    padding: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "#1890ff",
                  }}
                  onClick={handleInputNewDirectory}
                >
                  <PlusOutlined />
                  <Text>输入新目录</Text>
                </div>
              </>
            )}
          </div>
        )}
      >
        <Option value="">
          <Space>
            <FolderOutlined />
            <Text>根目录</Text>
          </Space>
        </Option>
        {directories.map((dir) => (
          <Option key={dir.path} value={dir.path}>
            <Space>
              <FolderOutlined />
              <Text>{dir.name}</Text>
            </Space>
          </Option>
        ))}
      </Select>

      {allowInput && showInput && (
        <Input
          size={size}
          placeholder="输入新目录路径（如：2024/06/10）"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyPress={handleInputKeyPress}
          autoFocus
          style={{ marginTop: "8px" }}
        />
      )}

      {value && (!showInput || !allowInput) && (
        <div style={{ fontSize: "12px", color: "#666" }}>
          <Text type="secondary">当前目录: {value || "根目录"}</Text>
        </div>
      )}
    </Space>
  );
};

export default DirectorySelector;
