import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Spin, message, Button, Tooltip } from 'antd';
import { ArrowLeftOutlined, EnvironmentOutlined } from '@ant-design/icons';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import coordtransform from 'coordtransform';
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
    className: 'custom-photo-marker-container', // Use container class for positioning
    html: `
      <div class="glass-marker">
        <div class="marker-image" style="background-image: url('${thumbUrl}')"></div>
        <div class="marker-arrow"></div>
      </div>
    `,
    iconSize: [48, 56], // Slightly larger for better touch targets
    iconAnchor: [24, 56],
    popupAnchor: [0, -56],
  });
};

// Custom Cluster Icon
const createClusterCustomIcon = function (cluster) {
  const count = cluster.getChildCount();
  let size = 'small';
  if (count > 10) size = 'medium';
  if (count > 50) size = 'large';

  // Get first child's image to use as background (optional, but cool)
  // const children = cluster.getAllChildMarkers();
  // const firstChildHtml = children[0].options.icon.options.html;
  // const bgMatch = firstChildHtml.match(/url\('([^']+)'\)/);
  // const bgUrl = bgMatch ? bgMatch[1] : '';

  return L.divIcon({
    html: `
      <div class="glass-cluster glass-cluster-${size}">
        <span>${count}</span>
      </div>
    `,
    className: 'custom-cluster-icon',
    iconSize: L.point(40, 40, true),
  });
};

const getDisplayCoordinates = (lat, lng) => {
  // Always convert WGS-84 to GCJ-02 for AutoNavi
  const [lngGcj, latGcj] = coordtransform.wgs84togcj02(lng, lat);
  return [latGcj, lngGcj];
};

const MarkerCluster = ({ markers, onMarkerClick }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !markers) return;

    const markerClusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      iconCreateFunction: createClusterCustomIcon,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false
    });

    const leafletMarkers = markers.map((marker, idx) => {
      if (!marker.lat || !marker.lng) return null;

      const latLng = getDisplayCoordinates(marker.lat, marker.lng);
      const leafletMarker = L.marker(latLng, {
        icon: createPhotoIcon(marker.thumbUrl)
      });

      leafletMarker.on('click', () => {
        onMarkerClick(idx);
      });

      return leafletMarker;
    }).filter(Boolean);

    markerClusterGroup.addLayers(leafletMarkers);
    map.addLayer(markerClusterGroup);

    return () => {
      map.removeLayer(markerClusterGroup);
    };
  }, [map, markers, onMarkerClick]);

  return null;
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
          const markersData = Array.isArray(res.data.data) ? res.data.data : [];
          const validMarkers = markersData.filter(m => m.lat && m.lng);
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

  const handleMarkerClick = useCallback((index) => {
    setSelectedIndex(index);
    setModalVisible(true);
  }, []);

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

  const marker = selectedIndex >= 0 ? state.markers[selectedIndex] : null;

  const currentFile = marker ? {
    ...marker,
    // Use existing URL if it's absolute (Mock mode), otherwise construct API URL
    url: marker.url && (marker.url.startsWith('http') || marker.url.startsWith('blob'))
      ? marker.url
      : `/api/images/${marker.relPath.split('/').map(encodeURIComponent).join('/')}`,
    uploadTime: marker.date || marker.uploadTime,
    size: marker.size || 0
  } : null;

  // CSS Styles for Glassmorphism
  const styles = `
    .glass-marker {
        width: 48px;
        height: 48px;
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 8px;
        padding: 3px;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
        position: relative;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        display: flex;
        justify-content: center;
        align-items: center;
    }
    
    .custom-photo-marker-container:hover .glass-marker {
        transform: scale(1.15) translateY(-4px);
        z-index: 1000;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
        border-color: rgba(0, 0, 0, 0.15);
        background: rgba(255, 255, 255, 0.85);
    }

    .marker-image {
        width: 100%;
        height: 100%;
        border-radius: 5px;
        background-size: cover;
        background-position: center;
        background-color: #f0f0f0;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);
    }

    .marker-arrow {
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0; 
        height: 0; 
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid rgba(255, 255, 255, 0.6);
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.05));
    }

    /* Cluster Styles */
    .glass-cluster {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(20, 20, 20, 0.75);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 600;
        color: #fff;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
        animation: pulse-light 3s infinite;
    }
    
    .glass-cluster span {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial;
        font-size: 14px;
    }

    @keyframes pulse-light {
        0% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.2); }
        70% { box-shadow: 0 0 0 8px rgba(0, 0, 0, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
    }
    
    /* Controls Styling */
    .map-control-btn {
        background: rgba(20, 20, 20, 0.75) !important;
        backdrop-filter: blur(8px) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
        color: #fff !important;
    }
    .map-control-btn:hover {
        background: rgba(40, 40, 40, 0.85) !important;
        border-color: rgba(255, 255, 255, 0.3) !important;
    }
    .leaflet-control-zoom a {
        background: rgba(20, 20, 20, 0.75) !important;
        backdrop-filter: blur(4px) !important;
        color: #fff !important;
        border-color: rgba(255, 255, 255, 0.15) !important;
    }
  `;

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

  const tileLayerProps = {
    url: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",
    attribution: '&copy; 高德地图',
    subdomains: ['1', '2', '3', '4'],
    minZoom: 3,
    maxZoom: 18
  };

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <style>{styles}</style>

      {/* Top Left Controls */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1000, display: 'flex', gap: 12 }}>
        <Tooltip title="返回列表" placement="right">
          <Button
            icon={<ArrowLeftOutlined />}
            className="map-control-btn"
            onClick={handleBack}
            size="large"
            shape="circle"
          />
        </Tooltip>
        <div style={{
          background: 'rgba(20, 20, 20, 0.75)',
          backdropFilter: 'blur(8px)',
          padding: '0 16px',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          color: '#fff'
        }}>
          <EnvironmentOutlined style={{ marginRight: 8 }} />
          <span style={{ fontWeight: 500 }}>{state.markers.length} 张照片</span>
        </div>
      </div>

      <MapContainer
        center={[35, 108]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          {...tileLayerProps}
        />
        <MarkerCluster markers={state.markers} onMarkerClick={handleMarkerClick} />
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
