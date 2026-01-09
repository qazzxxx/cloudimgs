import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Modal,
  Typography,
  Dropdown,
  Button,
  Space,
  Input,
  message,
  Select,
  Switch,
  Empty,
  Spin,
  theme,
} from "antd";
import {
  MoreOutlined,
  DeleteOutlined,
  EditOutlined,
  ShareAltOutlined,
  FolderOpenOutlined,
  CopyOutlined,
  FireOutlined,
  StopOutlined,
  PlusOutlined,
  LockOutlined,
  UnlockOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Text } = Typography;
const { Option } = Select;

const CountdownTimer = ({ expireSeconds, createdAt }) => {
    const [timeLeft, setTimeLeft] = useState("");
    
    useEffect(() => {
        if (!expireSeconds) return;
        
        const calculateTimeLeft = () => {
            const expireTime = dayjs(createdAt).add(expireSeconds, 'second');
            const now = dayjs();
            const diff = expireTime.diff(now, 'second');
            
            if (diff <= 0) {
                return "已过期";
            }
            
            const days = Math.floor(diff / (3600 * 24));
            const hours = Math.floor((diff % (3600 * 24)) / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            
            let str = "";
            if (days > 0) str += `${days}天 `;
            if (hours > 0) str += `${hours}小时 `;
            if (minutes > 0 || (days === 0 && hours === 0)) str += `${minutes}分`;
            
            return str;
        };
        
        setTimeLeft(calculateTimeLeft());
        
        const timer = setInterval(() => {
            const str = calculateTimeLeft();
            setTimeLeft(str);
            if (str === "已过期") clearInterval(timer);
        }, 60000); // Update every minute
        
        return () => clearInterval(timer);
    }, [expireSeconds, createdAt]);
    
    if (!expireSeconds) return "永久有效";
    return `剩余: ${timeLeft}`;
};

const AlbumManager = ({ visible, onClose, api, onSelectAlbum }) => {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  
  // Pagination / Chunk Rendering
  const [visibleCount, setVisibleCount] = useState(12);
  const scrollContainerRef = useRef(null);

  // ... (rest of state)
  const [shareExpiry, setShareExpiry] = useState(3600 * 24); // 1 day
  const [shareBurn, setShareBurn] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [shareList, setShareList] = useState([]);
  const [loadingShares, setLoadingShares] = useState(false);

  // Rename State
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Create State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createValue, setCreateValue] = useState("");

  // Password State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [isRemovingPassword, setIsRemovingPassword] = useState(false);

  const { token } = theme.useToken();

  const fetchAlbums = async () => {
    setLoading(true);
    try {
      const res = await api.get("/directories");
      if (res.data.success) {
        const allAlbums = res.data.data || [];
        const allImagesAlbum = {
          name: "全部图片",
          path: "",
          previews: allAlbums.flatMap(a => a.previews || []).slice(0, 3),
          mtime: new Date().toISOString(),
          isSystem: true
        };

        // Combine: [All Images, ...Real Albums]
        // Wait, user said: "全部图片 相册固定放在新建相册后面"
        // So order: [New Album Card (UI), All Images, ...Real Albums]
        setAlbums([allImagesAlbum, ...allAlbums]);
        
        // We also need to make sure visibleCount is enough to show at least the first few items
        // It defaults to 12, so it should be fine.
      }
    } catch (e) {
      message.error("获取相册列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchAlbums();
    }
  }, [visible]);

  const fetchShareList = async (path) => {
    setLoadingShares(true);
    try {
        const url = `/share/list?path=${encodeURIComponent(path)}`;
        const res = await api.get(url);
        if (res.data.success) {
            // Sort: Active first, then by createdAt desc
            const list = res.data.data || [];
            list.sort((a, b) => {
                const aActive = a.status === 'active';
                const bActive = b.status === 'active';
                if (aActive && !bActive) return -1;
                if (!aActive && bActive) return 1;
                return b.createdAt - a.createdAt;
            });
            setShareList(list);
        }
    } catch (e) {
        message.error("获取分享列表失败");
    } finally {
        setLoadingShares(false);
    }
  };

  const handleShare = async () => {
    if (!currentAlbum) return;
    setGeneratingLink(true);
    try {
      const res = await api.post("/share/generate", {
        path: currentAlbum.path,
        expireSeconds: shareExpiry,
        burnAfterReading: shareBurn,
      });
      if (res.data.success) {
        const url = `${window.location.origin}/share?token=${encodeURIComponent(res.data.token)}`;
        setShareLink(url);
        // Refresh list
        await fetchShareList(currentAlbum.path);
      }
    } catch (e) {
      message.error("生成分享链接失败");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleRevoke = async (signature) => {
      try {
          const res = await api.post("/share/revoke", {
              path: currentAlbum.path,
              signature
          });
          if (res.data.success) {
              message.success("链接已作废");
              fetchShareList(currentAlbum.path);
          }
      } catch (e) {
          message.error("作废失败");
      }
  };

  const handleDeleteShare = async (signature) => {
      try {
          const res = await api.delete("/share/delete", {
              data: {
                path: currentAlbum.path,
                signature
              }
          });
          if (res.data.success) {
              message.success("删除成功");
              fetchShareList(currentAlbum.path);
          }
      } catch (e) {
          message.error("删除失败");
      }
  };

  const handleCreate = async () => {
      if (!createValue.trim()) return;
      try {
          // Use API to create directory
          // Backend needs to support mkdir. 
          // Currently we don't have explicit mkdir API, but upload supports creating dir.
          // Let's add a mkdir API or use a hack? 
          // Wait, server code `fs.ensureDirSync(dest)` in upload logic creates it.
          // But we need a dedicated API.
          // Let's check server/index.js if there is one.
          // There isn't. I'll add one.
          
          const res = await api.post("/directories", {
              name: createValue.trim()
          });
          
          if (res.data.success) {
              message.success("相册创建成功");
              setCreateModalVisible(false);
              setCreateValue("");
              fetchAlbums();
          }
      } catch (e) {
          message.error(e.response?.data?.error || "创建失败");
      }
  };

  const handleRename = async () => {
    if (!currentAlbum || !renameValue.trim()) return;
    try {
      // Assuming PUT /api/images works for renaming directories if supported by backend,
      // actually backend usually supports renaming files. 
      // Checking server code: `PUT /api/images/*` supports `fs.rename`.
      // It works for directories too if `oldFilePath` points to a directory.
      // `safeJoin` works for dirs. `fs.pathExists` works. `fs.rename` works.
      // So yes, we can rename directories!
      
      const res = await api.put(`/images/${encodeURIComponent(currentAlbum.path)}`, {
        newName: renameValue.trim(),
        newDir: currentAlbum.path.split("/").slice(0, -1).join("/") // Keep parent dir
      });
      
      if (res.data.success) {
        message.success("重命名成功");
        setRenameModalVisible(false);
        fetchAlbums();
      }
    } catch (e) {
      message.error("重命名失败");
    }
  };

  const handleSavePassword = async () => {
    if (!currentAlbum) return;
    try {
        const res = await api.post("/album/password", {
            dir: currentAlbum.path,
            password: passwordValue
        });
        if (res.data.success) {
            message.success(passwordValue ? "密码设置成功" : "密码已移除");
            setPasswordModalVisible(false);
            setPasswordValue("");
            fetchAlbums(); // Refresh to update lock status
        }
    } catch (e) {
        message.error("操作失败");
    }
  };

  const handleDelete = async (album) => {
    Modal.confirm({
      title: "删除相册",
      content: `确定要删除相册 "${album.name}" 及其所有内容吗？此操作不可恢复。`,
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
           // DELETE /api/images/* works for directories too (fs.remove)
           await api.delete(`/images/${encodeURIComponent(album.path)}`);
           message.success("相册已删除");
           fetchAlbums();
        } catch (e) {
           message.error("删除失败");
        }
      }
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success("已复制到剪贴板");
    });
  };

  const handleClose = () => {
    setIsClosing(true);
    // Short delay to let the state update before triggering modal close animation
    // Actually, setting state will trigger re-render.
    // We want the re-render (hiding content) to happen BEFORE the modal starts closing?
    // No, we want it to happen AT THE SAME TIME or slightly before.
    // If we call onClose() immediately, Modal starts animating out.
    // At the same time React renders.
    // If we hide content, the modal becomes light.
    
    // We can just set isClosing(true), and let the Modal onCancel call this.
    onClose();
  };

  // Scroll handler for infinite loading
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, clientHeight, scrollHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < 100) {
        // Load more
        setVisibleCount(prev => Math.min(prev + 12, albums.length));
    }
  }, [albums.length]);

  // Attach scroll listener to scrollable container
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (visible && container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [visible, handleScroll]);

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      afterClose={() => {
          setAlbums([]);
          setLoading(true);
          setIsClosing(false);
          setVisibleCount(12);
      }}
      title={<div style={{ fontSize: 20, fontWeight: 600 }}>相册管理</div>}
      width={1000}
      footer={null}
      styles={{ body: { padding: 0, minHeight: 400, background: token.colorBgLayout } }}
    >
      <div 
        ref={scrollContainerRef}
        style={{ padding: "20px 32px", maxHeight: "60vh", overflowY: "auto", overflowX: "hidden" }}
      >
        {loading || isClosing ? (
          <div style={{ textAlign: "center", padding: 50 }}>
            {loading && !isClosing && <Spin size="large" />}
          </div>
        ) : albums.length === 0 ? (
          <Empty description="暂无相册" />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 24,
            }}
          >
            {/* Create New Album Card */}
            <div
                style={{
                    borderRadius: 12,
                    border: `2px dashed ${token.colorBorder}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    background: token.colorFillAlter,
                    transition: "all 0.3s",
                    margin: 24,
                    height: 200
                }}
                onClick={() => setCreateModalVisible(true)}
                onMouseEnter={e => {
                    e.currentTarget.style.borderColor = token.colorPrimary;
                    e.currentTarget.style.color = token.colorPrimary;
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.borderColor = token.colorBorder;
                    e.currentTarget.style.color = token.colorText;
                }}
            >
                <PlusOutlined style={{ fontSize: 32, marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 500 }}>新建相册</div>
            </div>

            {albums.slice(0, visibleCount).map((album) => (
              <AlbumCard
                key={album.path}
                album={album}
                token={token}
                isSystem={album.isSystem}
                onOpen={() => {
                    onSelectAlbum(album.path);
                    onClose();
                }}
                onShare={() => {
                    setCurrentAlbum(album);
                    setShareLink("");
                    setShareModalVisible(true);
                    fetchShareList(album.path);
                }}
                onRename={() => {
                    setCurrentAlbum(album);
                    setRenameValue(album.name);
                    setRenameModalVisible(true);
                }}
                onSetPassword={() => {
                    setCurrentAlbum(album);
                    setPasswordValue("");
                    setIsRemovingPassword(!!album.locked);
                    setPasswordModalVisible(true);
                }}
                onDelete={() => handleDelete(album)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Password Modal */}
      <Modal
        open={passwordModalVisible}
        onOk={handleSavePassword}
        onCancel={() => setPasswordModalVisible(false)}
        title={isRemovingPassword ? "修改/移除密码" : "设置相册密码"}
        okText="保存"
        cancelText="取消"
      >
          <div style={{ marginBottom: 16 }}>
              {isRemovingPassword ? "此相册已设置密码。输入新密码以修改，或留空以移除密码。" : "设置密码后，访问该相册将需要输入密码。"}
          </div>
          <Input.Password
            value={passwordValue} 
            onChange={e => setPasswordValue(e.target.value)} 
            placeholder={isRemovingPassword ? "留空移除密码" : "输入密码"} 
            autoFocus
          />
      </Modal>

      {/* Share Modal */}
      <Modal
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        title={<div style={{ fontSize: 18, fontWeight: 600 }}>分享相册 - {currentAlbum?.name}</div>}
        footer={null}
        width={600}
        centered
      >
        <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
        <Space direction="vertical" style={{ width: "100%", marginTop: 12 }} size="middle">
           
           <div>
               <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>生成新链接</div>
               
               <div style={{ background: token.colorFillAlter, padding: 16, borderRadius: 8 }}>
                   <div style={{ marginBottom: 16 }}>
                       <Text type="secondary" style={{ fontSize: 12 }}>有效期</Text>
                       <Select 
                         style={{ width: "100%", marginTop: 4 }} 
                         value={shareExpiry}
                         onChange={setShareExpiry}
                       >
                           <Option value={3600}>1 小时</Option>
                           <Option value={3600 * 24}>1 天</Option>
                           <Option value={3600 * 24 * 7}>7 天</Option>
                           <Option value={3600 * 24 * 30}>30 天</Option>
                           <Option value={0}>永久有效</Option>
                       </Select>
                   </div>

                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                       <Space>
                           <FireOutlined style={{ color: "#ff4d4f" }} />
                           <span style={{ fontSize: 14 }}>阅后即焚 (一次性访问)</span>
                       </Space>
                       <Switch checked={shareBurn} onChange={setShareBurn} />
                   </div>

                   <Button type="primary" block onClick={handleShare} loading={generatingLink} icon={<ShareAltOutlined />}>
                       生成并复制链接
                   </Button>
               </div>
           </div>
           
           {/* Show newly generated link specifically if needed, but list updates automatically */}
           {shareLink && (
               <div style={{ marginTop: 8, padding: 8, background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 4, textAlign: "center", color: "#52c41a" }}>
                   <CheckCircleIcon /> 新链接已生成并添加到列表
               </div>
           )}

           {/* Active Shares List */}
           <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 16, marginTop: 8 }}>
               <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>分享列表</div>
               {loadingShares ? (
                   <div style={{ textAlign: "center", padding: 20 }}><Spin /></div>
               ) : shareList.length === 0 ? (
                   <div style={{ padding: "20px 0", textAlign: "center", color: token.colorTextSecondary, background: token.colorFillAlter, borderRadius: 8 }}>
                       暂无分享记录
                   </div>
               ) : (
                   <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                       {shareList.map((share, idx) => (
                           <div key={idx} style={{ 
                               border: `1px solid ${token.colorBorderSecondary}`, 
                               borderRadius: 8, 
                               padding: 12,
                               display: "flex",
                               justifyContent: "space-between",
                               alignItems: "center",
                               background: token.colorBgContainer
                           }}>
                               <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                                   <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                       {share.status === "revoked" ? (
                                           <div style={{ color: "#ff4d4f", fontSize: 12, border: "1px solid #ff4d4f", padding: "0 4px", borderRadius: 4 }}>已作废</div>
                                       ) : share.status === "expired" ? (
                                           <div style={{ color: "#d9d9d9", fontSize: 12, border: "1px solid #d9d9d9", padding: "0 4px", borderRadius: 4 }}>已过期</div>
                                       ) : share.status === "burned" ? (
                                           <div style={{ color: "#d9d9d9", fontSize: 12, border: "1px solid #d9d9d9", padding: "0 4px", borderRadius: 4 }}>已焚毁</div>
                                       ) : share.burnAfterReading ? (
                                            <div style={{ color: "#faad14", fontSize: 12, border: "1px solid #faad14", padding: "0 4px", borderRadius: 4 }}>阅后即焚</div>
                                       ) : (
                                            <div style={{ color: "#52c41a", fontSize: 12, border: "1px solid #52c41a", padding: "0 4px", borderRadius: 4 }}>
                                                <CountdownTimer expireSeconds={share.expireSeconds} createdAt={share.createdAt} />
                                            </div>
                                       )}
                                       <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                                           {dayjs(share.createdAt).format("MM-DD HH:mm")}
                                       </div>
                                   </div>
                                   <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                       <Input 
                                           size="small" 
                                           value={`${window.location.origin}/share?token=${encodeURIComponent(share.token)}`} 
                                           readOnly 
                                           style={{ fontSize: 12, background: token.colorFillAlter, textDecoration: share.status !== 'active' ? 'line-through' : 'none', color: share.status !== 'active' ? token.colorTextDisabled : undefined }}
                                       />
                                       <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(`${window.location.origin}/share?token=${encodeURIComponent(share.token)}`)} disabled={share.status !== 'active'} />
                                   </div>
                               </div>
                               <Space size="small">
                                   {share.status === 'active' && (
                                       <Button 
                                           danger 
                                           size="small" 
                                           type="text" 
                                           icon={<StopOutlined />} 
                                           onClick={() => handleRevoke(share.signature)}
                                       >
                                           作废
                                       </Button>
                                   )}
                                   <Button 
                                       size="small" 
                                       type="text" 
                                       icon={<DeleteOutlined />} 
                                       onClick={() => handleDeleteShare(share.signature)}
                                   >
                                       删除
                                   </Button>
                               </Space>
                           </div>
                       ))}
                   </div>
               )}
           </div>

        </Space>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal
        open={renameModalVisible}
        onOk={handleRename}
        onCancel={() => setRenameModalVisible(false)}
        title="重命名相册"
      >
          <Input 
            value={renameValue} 
            onChange={e => setRenameValue(e.target.value)} 
            placeholder="输入新名称" 
          />
      </Modal>

      {/* Create Modal */}
      <Modal
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => setCreateModalVisible(false)}
        title="新建相册"
      >
          <Input 
            value={createValue} 
            onChange={e => setCreateValue(e.target.value)} 
            placeholder="输入相册名称 (支持多级如 A/B)" 
            autoFocus
          />
      </Modal>
    </Modal>
  );
};

const AlbumCard = React.memo(({ album, token, onOpen, onShare, onRename, onDelete, onSetPassword, isSystem }) => {
    const [hover, setHover] = useState(false);
    
    // Previews logic
    const previews = album.previews || [];
    const displayPreviews = React.useMemo(() => [...previews].reverse().slice(0, 3), [previews]);

    return (
        <div
          style={{
              position: "relative",
              height: 200, // Match Create Card height
              margin: 24,  // Match Create Card margin
              cursor: "pointer",
              perspective: "1000px"
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={onOpen}
        >
            {/* Lock Overlay */}
            {album.locked && (
                <div style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    zIndex: 20,
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    padding: 6,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}>
                    <LockOutlined />
                </div>
            )}

            {/* Stacked Images */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 60 }}>
                {displayPreviews.length > 0 ? (
                    displayPreviews.map((src, index) => {
                        // index 0 is bottom, index 2 is top
                        // We want top one to be index 0 in map if we reversed? 
                        // Actually, let's just absolute position them.
                        const isTop = index === 0; // After reverse, 0 is the last one (top)? No.
                        // Let's assume displayPreviews[0] is the top one.
                        
                        // We need stable keys.
                        const offset = index * 4;
                        // 默认展开一定角度 (例如：5度，10px位移)，悬浮时进一步展开
                        const rotate = hover ? (index - 1) * 15 : (index - 1) * 5;
                        const translateY = hover ? -20 : -5;
                        const translateX = hover ? (index - 1) * 30 : (index - 1) * 10;
                        const scale = 1 - index * 0.05;
                        const zIndex = 10 - index;
                        
                        return (
                            <div
                                key={index}
                                style={{
                                    position: "absolute",
                                    top: offset,
                                    left: offset,
                                    right: offset,
                                    bottom: offset,
                                    borderRadius: 12,
                                    background: token.colorBgContainer,
                                    backgroundImage: `url(${src})`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                    zIndex: zIndex,
                                    transform: `translateY(${translateY}px) translateX(${translateX}px) rotate(${rotate}deg) scale(${scale})`,
                                    transformOrigin: "bottom center",
                                    transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                    border: `2px solid ${token.colorBgContainer}`,
                                    opacity: 1
                                }}
                            />
                        );
                    })
                ) : (
                    <div style={{
                        height: "100%",
                        background: token.colorFillAlter,
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1px dashed ${token.colorBorder}`
                    }}>
                        <FolderOpenOutlined style={{ fontSize: 32, color: token.colorTextQuaternary }} />
                    </div>
                )}
            </div>

            {/* Info Area */}
            <div style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 8px"
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {album.name}
                    </div>
                    <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                        {dayjs(album.mtime).format("YYYY-MM-DD")}
                    </div>
                </div>
                
                <Dropdown
                    menu={{
                        items: [
                            { key: 'share', label: '分享相册', icon: <ShareAltOutlined />, onClick: (e) => { e.domEvent.stopPropagation(); onShare(); } },
                            !isSystem && { key: 'password', label: album.locked ? '管理密码' : '设置密码', icon: album.locked ? <UnlockOutlined /> : <LockOutlined />, onClick: (e) => { e.domEvent.stopPropagation(); onSetPassword(); } },
                            // System albums cannot be renamed or deleted
                            !isSystem && { key: 'rename', label: '重命名', icon: <EditOutlined />, onClick: (e) => { e.domEvent.stopPropagation(); onRename(); } },
                            !isSystem && { type: 'divider' },
                            !isSystem && { key: 'delete', label: '删除相册', icon: <DeleteOutlined />, danger: true, onClick: (e) => { e.domEvent.stopPropagation(); onDelete(); } },
                        ].filter(Boolean)
                    }}
                    trigger={['click']}
                >
                    <Button 
                        type="text" 
                        icon={<MoreOutlined />} 
                        onClick={e => e.stopPropagation()}
                    />
                </Dropdown>
            </div>
        </div>
    );
});

const CheckCircleIcon = () => (
    <span style={{ marginRight: 6 }}>✓</span>
);

export default AlbumManager;
