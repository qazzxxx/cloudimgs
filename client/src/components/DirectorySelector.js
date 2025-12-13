import React, { useState, useEffect, useRef } from "react";
import { Select, Input, Space, Typography, Divider, Button } from "antd";
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
  const inputRef = useRef(null);

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

  const handleInputKeyPress = (e) => {
    if (e.key === "Enter") {
      addNewDirectory();
    }
  };

  const handleSearch = (searchValue) => {
    // 搜索功能已通过filterOption实现
  };

  const addNewDirectory = (e) => {
    if (e) e.preventDefault?.();
    const val = (inputValue || "").trim();
    if (!val) return;
    const name =
      val
        .split("/")
        .filter(Boolean)
        .pop() || val;
    setDirectories((prev) => {
      if (!prev.find((d) => d.path === val)) {
        return [...prev, { name, path: val, fullPath: "" }];
      }
      return prev;
    });
    if (onChange) {
      onChange(val);
    }
    setInputValue("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
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
                <Space style={{ padding: "0 8px 8px", width: "100%" }}>
                  <Input
                    placeholder="输入新目录路径（如：2025/12/13）"
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.stopPropagation()}
                    onKeyPress={handleInputKeyPress}
                    size={size}
                  />
                  <Button type="text" icon={<PlusOutlined />} onClick={addNewDirectory}>
                    添加
                  </Button>
                </Space>
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
      
    </Space>
  );
};

export default DirectorySelector;
