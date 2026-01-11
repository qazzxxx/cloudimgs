import React, { useState, useEffect, useRef } from "react";
import { Select, Input, Space, Typography, Divider, message } from "antd";
import { FolderOutlined, PlusOutlined } from "@ant-design/icons";

const { Option } = Select;
const { Text } = Typography;

const DirectorySelector = ({
  value,
  onChange,
  placeholder = "选择或输入相册",
  style = {},
  allowClear = true,
  showSearch = true,
  size = "middle",
  allowInput = true,
  api,
  refreshKey = 0,
}) => {
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createName, setCreateName] = useState("");
  const inputRef = useRef(null);

  // 获取相册列表
  const fetchDirectories = async () => {
    setLoading(true);
    try {
      const response = await api.get("/directories");
      if (response.data.success) {
        setDirectories(response.data.data);
      }
    } catch (error) {
      console.error("获取相册列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectories();
  }, [refreshKey]);

  const handleSelectChange = (selectedValue) => {
    if (onChange) {
      onChange(selectedValue);
    }
  };

  const handleInputChange = (e) => {
    setCreateName(e.target.value);
  };

  const handleInputKeyPress = (e) => {
    if (e.key === "Enter") {
      addNewDirectory();
    }
  };

  const handleSearch = (searchValue) => {
    // 搜索功能已通过filterOption实现
  };

  const addNewDirectory = async (e) => {
    if (e) e.preventDefault?.();
    const val = (createName || "").trim();
    if (!val) return;

    try {
        const res = await api.post("/directories", { name: val });
        if (res.data.success) {
             message.success("相册创建成功");
             await fetchDirectories();
             if (onChange) {
                // Use returned path if available, or input value
                const newPath = res.data.data?.path || val;
                onChange(newPath);
             }
             setCreateName("");
        }
    } catch (e) {
        message.error(e.response?.data?.error || "创建失败");
    }

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
        notFoundContent={loading ? "加载中..." : "暂无相册"}
        popupClassName="directory-selector-dropdown"
        dropdownRender={(menu) => (
          <div>
            {menu}
            {allowInput && (
              <>
                <Divider style={{ margin: "8px 0" }} />
                <div style={{ padding: "0 8px 8px" }}>
                  <Input
                    placeholder="输入新相册名称 (支持多级如 A/B)"
                    ref={inputRef}
                    value={createName}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.stopPropagation()}
                    onKeyPress={handleInputKeyPress}
                    size={size}
                    suffix={
                      <PlusOutlined
                        style={{ cursor: "pointer" }}
                        onClick={addNewDirectory}
                      />
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}
      >
        <Option value="">
          <Space>
            <FolderOutlined />
            <Text>全部图片</Text>
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
