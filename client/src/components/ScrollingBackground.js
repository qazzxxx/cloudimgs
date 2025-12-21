import React, { useEffect, useRef, useState } from "react";
import api from "../utils/api";

const ScrollingBackground = () => {
  const [images, setImages] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    // Fetch some random images to display in the background
    const fetchBackgroundImages = async () => {
      try {
        // Try to fetch from our own API first to show actual content
        const res = await api.get("/images", { params: { page: 1, pageSize: 20 } });
        if (res.data && res.data.success && res.data.data.length > 0) {
          setImages(res.data.data);
        } else {
            // Fallback to placeholder if no images or empty
             setImages(Array.from({ length: 15 }).map((_, i) => ({
                 url: `https://picsum.photos/seed/${i}/400/600`,
                 key: i
             })));
        }
      } catch (e) {
         // Fallback on error (likely 401, which is expected here)
         // Since we can't see images without auth, we should use placeholders 
         // OR just show a nice abstract pattern if we want to be strict.
         // But the user asked for "Massive Image Background", implying they want to see what's inside vaguely.
         // However, showing real private images before password might be a security concern?
         // User asked: "后面是海量的图片背景" -> "Behind is a massive image background".
         // Usually this means a generic wall or blurred version of content.
         // Safe bet: Use high quality placeholder nature/architecture images for the "vibe".
         setImages(Array.from({ length: 24 }).map((_, i) => ({
             url: `https://picsum.photos/seed/${i + 100}/300/450`,
             key: i
         })));
      }
    };
    fetchBackgroundImages();
  }, []);

  // Prepare columns for masonry-like scroll
  const columns = [[], [], [], []];
  images.forEach((img, i) => {
    columns[i % 4].push(img);
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "-10%",
        left: "-10%",
        width: "120%",
        height: "120%",
        zIndex: 0,
        overflow: "hidden",
        display: "flex",
        gap: "20px",
        transform: "rotate(-5deg)", // Slight tilt for style
        opacity: 0.6,
      }}
    >
      {columns.map((col, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            animation: `scrollColumn ${30 + i * 5}s linear infinite`,
            animationDirection: i % 2 === 0 ? "normal" : "reverse",
          }}
        >
          {/* Duplicate for seamless loop */}
          {[...col, ...col, ...col].map((img, idx) => (
            <div
              key={`${i}-${idx}`}
              style={{
                width: "100%",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            >
              <img
                src={img.url}
                alt=""
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  objectFit: "cover",
                }}
              />
            </div>
          ))}
        </div>
      ))}
      <style>
        {`
          @keyframes scrollColumn {
            0% { transform: translateY(0); }
            100% { transform: translateY(-33.33%); }
          }
        `}
      </style>
    </div>
  );
};

export default ScrollingBackground;
