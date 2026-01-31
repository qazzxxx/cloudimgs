import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Row, Col, Typography, Table, Spin, message, Empty, Segmented } from 'antd';
import { AreaChartOutlined, FireOutlined, EyeOutlined, VideoCameraOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const TrafficDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [trafficData, setTrafficData] = useState([]);
    const [topImages, setTopImages] = useState([]);
    const [days, setDays] = useState(30);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [trafficRes, topRes] = await Promise.all([
                    api.get(`/stats/traffic?days=${days}`),
                    api.get('/stats/top?limit=10')
                ]);

                if (trafficRes.data.success) {
                    setTrafficData(trafficRes.data.data);
                }
                if (topRes.data.success) {
                    setTopImages(topRes.data.data);
                }
            } catch (e) {
                console.error(e);
                message.error("获取统计数据失败");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [days]);

    // Chart Configs
    const trafficOption = {
        title: { text: '流量与上传趋势', left: 'center' },
        tooltip: { trigger: 'axis' },
        legend: { data: ['访问流量 (MB)', '上传流量 (MB)', '访问次数', '上传次数'], bottom: 0 },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: { type: 'category', data: trafficData.map(d => d.date) },
        yAxis: [
            { type: 'value', name: '流量 (MB)', position: 'left' },
            { type: 'value', name: '次数', position: 'right' }
        ],
        series: [
            {
                name: '访问流量 (MB)',
                type: 'line',
                smooth: true,
                data: trafficData.map(d => (d.views_size / 1024 / 1024).toFixed(2)),
                areaStyle: { opacity: 0.1 },
                itemStyle: { color: '#52c41a' }
            },
            {
                name: '上传流量 (MB)',
                type: 'line',
                smooth: true,
                data: trafficData.map(d => (d.uploads_size / 1024 / 1024).toFixed(2)),
                areaStyle: { opacity: 0.1 },
                itemStyle: { color: '#1890ff' }
            },
            {
                name: '访问次数',
                type: 'bar',
                yAxisIndex: 1,
                data: trafficData.map(d => d.views_count),
                itemStyle: { color: '#95de64', opacity: 0.5 }
            },
            {
                name: '上传次数',
                type: 'bar',
                yAxisIndex: 1,
                data: trafficData.map(d => d.uploads_count),
                itemStyle: { color: '#69c0ff', opacity: 0.5 }
            }
        ]
    };

    const topImagesColumns = [
        {
            title: '图片',
            dataIndex: 'url',
            key: 'url',
            render: (url, record) => {
                const isVideo = /\.(mp4|webm|mov)$/i.test(record.filename);
                if (isVideo) {
                    return (
                        <div style={{ height: 40, width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.05)', borderRadius: 4 }}>
                            <VideoCameraOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                        </div>
                    );
                }
                return <img src={url} alt="preview" style={{ height: 40, borderRadius: 4 }} />;
            }
        },
        {
            title: '文件名',
            dataIndex: 'filename',
            key: 'filename',
            ellipsis: true,
        },
        {
            title: '浏览量',
            dataIndex: 'views',
            key: 'views',
            sorter: (a, b) => a.views - b.views,
            defaultSortOrder: 'descend',
            render: (v) => <Text strong><EyeOutlined /> {v}</Text>
        },
        {
            title: '上传时间',
            dataIndex: 'uploadTime',
            key: 'uploadTime',
            render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm')
        }
    ];

    if (loading && trafficData.length === 0) {
        return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;
    }

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Title level={2} style={{ margin: 0 }}><AreaChartOutlined /> 流量看板</Title>
                <Segmented
                    options={[
                        { label: '近 7 天', value: 7 },
                        { label: '近 30 天', value: 30 },
                        { label: '近 90 天', value: 90 }
                    ]}
                    value={days}
                    onChange={setDays}
                />
            </div>

            <Row gutter={[20, 20]}>
                <Col span={24}>
                    <Card style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        {trafficData.length > 0 ? (
                            <ReactECharts option={trafficOption} style={{ height: 400 }} />
                        ) : (
                            <Empty description="暂无流量数据" />
                        )}
                    </Card>
                </Col>

                <Col span={24}>
                    <Card
                        title={<><FireOutlined style={{ color: '#ff4d4f' }} /> 热门图片 (Top 10)</>}
                        style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    >
                        <Table
                            dataSource={topImages}
                            columns={topImagesColumns}
                            rowKey="relPath"
                            pagination={false}
                            size="small"
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default TrafficDashboard;
