import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Spin, message, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import api from '../utils/api';
import ImageDetailModal from './ImageDetailModal';

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const createPhotoIcon = (thumbUrl) => {
  return L.divIcon({
    className: 'custom-photo-marker',
    html: `
      <div style="
        width: 44px;
        height: 44px;
        background-image: url('${thumbUrl}');
        background-size: cover;
        background-position: center;
        border-radius: 6px;
        border: 2px solid white;
        box-shadow: 0 3px 6px rgba(0,0,0,0.4);
        position: relative;
      ">
        <div style="
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0; 
          height: 0; 
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid white;
        "></div>
      </div>
    `,
    iconSize: [44, 50],
    iconAnchor: [22, 50],
    popupAnchor: [0, -50],
  });
};

function MapPage() {
  const [state, setState] = useState({
    loading: true,
    markers: [],
    error: null
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const res = await api.get('/map-data');
        if (res.data.success) {
          // Filter out invalid coordinates just in case
          const validMarkers = res.data.data.filter(m => m.lat && m.lng);
          setState({
            loading: false,
            markers: validMarkers,
            error: null
          });
        } else {
           throw new Error(res.data.error);
        }
      } catch (err) {
        setState(prev => ({ ...prev, loading: false, error: err.message || "加载失败" }));
        message.error('加载地图数据失败: ' + (err.message || "未知错误"));
      }
    };

    fetchMapData();
  }, []);

  const handleBack = () => {
    window.location.href = '/';
  };

  const handleMarkerClick = (index) => {
    setSelectedIndex(index);
    setModalVisible(true);
  };

  const handleNext = () => {
    if (selectedIndex < state.markers.length - 1) {
      setSelectedIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (selectedIndex > 0) {
      setSelectedIndex(prev => prev - 1);
    }
  };

  const handleDelete = async (relPath) => {
    try {
      await api.delete(`/images/${encodeURIComponent(relPath)}`);
      message.success("删除成功");
      setState(prev => ({
        ...prev,
        markers: prev.markers.filter(m => m.relPath !== relPath)
      }));
      setModalVisible(false); // Close modal after delete
    } catch (e) {
      message.error("删除失败");
    }
  };

  const handleUpdate = (updatedFile) => {
    setState(prev => ({
      ...prev,
      markers: prev.markers.map(m => 
        m.relPath === updatedFile.relPath || m.relPath === updatedFile.oldRelPath 
          ? { ...m, ...updatedFile, date: updatedFile.uploadTime, thumbUrl: updatedFile.url + '?w=200' } // Ensure essential props
          : m
      )
    }));
  };

  const currentFile = selectedIndex >= 0 && state.markers[selectedIndex] ? {
    ...state.markers[selectedIndex],
    url: `/api/images/${state.markers[selectedIndex].relPath.split('/').map(encodeURIComponent).join('/')}`,
    uploadTime: state.markers[selectedIndex].date, // Map date to uploadTime
    size: 0 // Size might be unknown here
  } : null;

  if (state.loading) {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spin size="large" tip="正在加载地图数据..." /></div>;
  }

  if (state.error) {
    return (
        <div style={{ padding: 20, textAlign: 'center', paddingTop: 100 }}>
            <h3>Error: {state.error}</h3>
            <Button onClick={handleBack}>返回首页</Button>
        </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <Button 
        icon={<ArrowLeftOutlined />} 
        style={{ position: 'absolute', top: 20, left: 20, zIndex: 1000 }} 
        onClick={handleBack}
      >
        返回列表
      </Button>
      
      <MapContainer center={[35, 105]} zoom={4} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MarkerClusterGroup chunkedLoading>
          {state.markers.map((marker, idx) => (
            <Marker 
              key={`${marker.filename}-${idx}`} 
              position={[marker.lat, marker.lng]}
              icon={createPhotoIcon(marker.thumbUrl)}
              eventHandlers={{
                click: () => handleMarkerClick(idx)
              }}
            >
              {/* Removed Popup to allow direct click to modal */}
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      <ImageDetailModal
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        file={currentFile}
        api={api}
        onNext={handleNext}
        onPrev={handlePrev}
        hasNext={selectedIndex < state.markers.length - 1}
        hasPrev={selectedIndex > 0}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
      />
    </div>
  );
}

export default MapPage;
