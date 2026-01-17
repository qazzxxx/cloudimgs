import React, { useEffect, useState } from "react";
import api from "../utils/api";

const ScrollingBackground = ({ usePicsum = false }) => {
  const [images, setImages] = useState([]);

  useEffect(() => {
    // Fetch some random images to display in the background
    const fetchBackgroundImages = async () => {
      if (usePicsum) {
        setImages(Array.from({ length: 32 }).map((_, i) => ({
          url: `https://picsum.photos/seed/${i + 500}/300/450`,
          key: i
        })));
        return;
      }

      try {
        // Try to fetch from our own API first to show actual content
        const res = await api.get("/images", { params: { page: 1, pageSize: 20 } });
        if (res.data && res.data.success && res.data.data.length > 0) {
          setImages(res.data.data);
        } else {
          // Fallback to placeholder if no images or empty
          setImages(Array.from({ length: 24 }).map((_, i) => ({
            url: `https://picsum.photos/seed/${i + 200}/300/450`,
            key: i
          })));
        }
      } catch (e) {
        setImages(Array.from({ length: 32 }).map((_, i) => ({
          url: `https://picsum.photos/seed/${i + 100}/300/450`,
          key: i
        })));
      }
    };
    fetchBackgroundImages();
  }, [usePicsum]);

  // Prepare columns for masonry-like scroll
  const columns = [[], [], [], [], []];
  images.forEach((img, i) => {
    columns[i % 5].push(img);
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "-20%", // Extend beyond viewport to cover rotation gaps
        left: "-20%",
        width: "140%",
        height: "140%",
        zIndex: 0,
        overflow: "hidden",
        display: "flex",
        gap: "24px",
        transform: "rotate(-8deg)", // Artistic tilt
        opacity: 0.5,
        pointerEvents: "none", // Ensure clicks pass through
      }}
    >
      {columns.map((col, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            position: "relative",
            height: "200%", // Double height for scrolling container
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            // Use transform3d for hardware acceleration
            transform: "translate3d(0, 0, 0)",
            willChange: "transform",
            animation: `scrollColumn-${i % 2 === 0 ? 'up' : 'down'} ${45 + i * 8}s linear infinite`,
          }}
        >
          {/* 
             Render duplicated content 3 times to ensure no gaps during the infinite scroll loop.
             We need enough content to cover the viewport height plus the scroll distance.
          */}
          {[...col, ...col, ...col, ...col].map((img, idx) => (
            <div
              key={`${i}-${idx}`}
              style={{
                width: "100%",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                // Fixed height to ensure stability during loading
                minHeight: "200px",
                background: "rgba(255,255,255,0.05)",
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
                  // Fade in effect could be added here
                }}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      ))}
      <style>
        {`
          @keyframes scrollColumn-up {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(0, -50%, 0); } /* Move half way (since we have 4x content, 50% is 2x content, enough for loop) */
          }
          @keyframes scrollColumn-down {
            0% { transform: translate3d(0, -50%, 0); }
            100% { transform: translate3d(0, 0, 0); }
          }
        `}
      </style>
    </div>
  );
};

export default ScrollingBackground;
