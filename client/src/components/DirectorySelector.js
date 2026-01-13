import React, { useState, useEffect, useRef, useCallback } from "react";
import { Select, Input, Space, Typography, Divider, message } from "antd";
import { FolderOutlined, PlusOutlined, RightOutlined, DownOutlined } from "@ant-design/icons";

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
  enabled = true,
}) => {
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createName, setCreateName] = useState("");
  const [expandedPaths, setExpandedPaths] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef(null);

  // 获取相册列表
  const fetchDirectories = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/directories?recursive=true");
      if (response.data.success) {
        setDirectories(response.data.data);
      }
    } catch (error) {
      console.error("获取相册列表失败:", error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (enabled) {
      fetchDirectories();
    }
  }, [refreshKey, fetchDirectories, enabled]);

  // Auto expand parents of the current value
  useEffect(() => {
    if (value && directories.length > 0) {
      const parts = value.split("/");
      if (parts.length > 1) {
        const pathsToExpand = [];
        let currentPath = "";
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
          pathsToExpand.push(currentPath);
        }
        setExpandedPaths(prev => Array.from(new Set([...prev, ...pathsToExpand])));
      }
    }
  }, [value, directories]);

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
    setIsSearching(!!searchValue);
  };

  const toggleExpand = (e, path) => {
    e.stopPropagation(); // Prevent selection
    setExpandedPaths(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path) 
        : [...prev, path]
    );
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
        optionLabelProp="label"
        filterOption={(input, option) => {
          if (!input) return true;
          // Use search text from the dir name or path
          const searchContent = option.searchValue || "";
          return searchContent.toLowerCase().indexOf(input.toLowerCase()) >= 0;
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
        <Option value="" searchValue="全部图片" label="全部图片">
          <Space>
            <FolderOutlined />
            <Text>全部图片</Text>
          </Space>
        </Option>
        {directories.map((dir) => {
          const parts = (dir.path || "").split("/").filter(Boolean);
          const depth = parts.length - 1;
          const isExpanded = expandedPaths.includes(dir.path);
          const hasChildren = directories.some(d => d.path !== dir.path && d.path.startsWith(dir.path + '/'));
          
          // Visibility check
          let isVisible = true;
          if (parts.length > 1 && !isSearching) {
            let currentPath = "";
            for (let i = 0; i < parts.length - 1; i++) {
              currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
              if (!expandedPaths.includes(currentPath)) {
                isVisible = false;
                break;
              }
            }
          }

          if (!isVisible && !isSearching) return null;

          return (
            <Option key={dir.path} value={dir.path} searchValue={dir.name} label={dir.name}>
              <div style={{ paddingLeft: depth * 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space size={4}>
                  <FolderOutlined style={{ color: '#1890ff' }} />
                  <Text>{dir.name}</Text>
                </Space>
                {hasChildren && !isSearching && (
                   <div 
                     onClick={(e) => toggleExpand(e, dir.path)}
                     style={{ 
                       padding: '0 4px', 
                       cursor: 'pointer', 
                       display: 'flex', 
                       alignItems: 'center',
                       height: '100%',
                       marginLeft: '8px'
                     }}
                   >
                     {isExpanded ? <DownOutlined style={{ fontSize: 10, color: '#999' }} /> : <RightOutlined style={{ fontSize: 10, color: '#999' }} />}
                   </div>
                )}
              </div>
            </Option>
          );
        })}
      </Select>
      
    </Space>
  );
};

export default DirectorySelector;
