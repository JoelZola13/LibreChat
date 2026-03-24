"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  Grid,
  Image as ImageIcon,
} from "lucide-react";

type GalleryImage = {
  id: string;
  url: string;
  thumbnail?: string;
  name?: string;
  sender_name?: string;
  sent_at?: string;
  message_id?: number;
};

interface ImageGalleryModalProps {
  images: GalleryImage[];
  initialIndex?: number;
  onClose: () => void;
  onNavigateToMessage?: (messageId: number) => void;
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
  };
}

export function ImageGalleryModal({
  images,
  initialIndex = 0,
  onClose,
  onNavigateToMessage,
  colors,
}: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentImage = images[currentIndex];

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          goToPrevious();
          break;
        case "ArrowRight":
          goToNext();
          break;
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
        case "r":
          handleRotate();
          break;
        case "g":
          setShowThumbnails((prev) => !prev);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrevious, handleRotate, handleZoomIn, handleZoomOut, onClose]);

  // Reset zoom and rotation when image changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setIsLoading(true);
  }, [currentIndex]);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = currentImage.url;
    link.download = currentImage.name || `image-${currentImage.id}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: `1px solid ${colors.border}`,
          background: "rgba(0,0,0,0.5)",
        }}
      >
        {/* Left - Image info */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ color: colors.textSecondary, fontSize: "0.875rem" }}>
            {currentIndex + 1} / {images.length}
          </span>
          {currentImage.sender_name && (
            <span style={{ color: colors.text, fontSize: "0.875rem" }}>
              Sent by <strong>{currentImage.sender_name}</strong>
            </span>
          )}
          {currentImage.sent_at && (
            <span style={{ color: colors.textMuted, fontSize: "0.75rem" }}>
              {formatDate(currentImage.sent_at)}
            </span>
          )}
        </div>

        {/* Right - Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            onClick={handleZoomOut}
            title="Zoom out (-)"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: colors.textSecondary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ZoomOut size={18} />
          </button>
          <span style={{ color: colors.textMuted, fontSize: "0.75rem", minWidth: "48px", textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            title="Zoom in (+)"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: colors.textSecondary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ZoomIn size={18} />
          </button>

          <div style={{ width: "1px", height: "20px", background: colors.border, margin: "0 8px" }} />

          <button
            onClick={handleRotate}
            title="Rotate (R)"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: colors.textSecondary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RotateCw size={18} />
          </button>

          <button
            onClick={() => setShowThumbnails((prev) => !prev)}
            title="Toggle thumbnails (G)"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: showThumbnails ? colors.surfaceHover : "transparent",
              color: showThumbnails ? colors.accent : colors.textSecondary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Grid size={18} />
          </button>

          <button
            onClick={handleDownload}
            title="Download"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: colors.textSecondary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Download size={18} />
          </button>

          {currentImage.message_id && onNavigateToMessage && (
            <button
              onClick={() => {
                onNavigateToMessage(currentImage.message_id!);
                onClose();
              }}
              title="Go to message"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                color: colors.textSecondary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ExternalLink size={18} />
            </button>
          )}

          <div style={{ width: "1px", height: "20px", background: colors.border, margin: "0 8px" }} />

          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: colors.textSecondary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Previous button */}
        {images.length > 1 && (
          <button
            onClick={goToPrevious}
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,0.5)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.5)";
            }}
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* Image */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            maxWidth: "100%",
            maxHeight: "100%",
            padding: "20px",
          }}
        >
          {isLoading && (
            <div
              style={{
                position: "absolute",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                color: colors.textMuted,
              }}
            >
              <ImageIcon size={48} />
              <span>Loading...</span>
            </div>
          )}
          <img loading="lazy" decoding="async"
            src={currentImage.url}
            alt={currentImage.name || "Gallery image"}
            onLoad={() => setIsLoading(false)}
            style={{
              maxWidth: "100%",
              maxHeight: "calc(100vh - 200px)",
              objectFit: "contain",
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: "transform 0.2s",
              opacity: isLoading ? 0 : 1,
            }}
          />
        </div>

        {/* Next button */}
        {images.length > 1 && (
          <button
            onClick={goToNext}
            style={{
              position: "absolute",
              right: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,0.5)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.5)";
            }}
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {showThumbnails && images.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "12px",
            borderTop: `1px solid ${colors.border}`,
            background: "rgba(0,0,0,0.5)",
            overflowX: "auto",
          }}
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setCurrentIndex(index)}
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "8px",
                border: index === currentIndex ? `2px solid ${colors.accent}` : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                overflow: "hidden",
                opacity: index === currentIndex ? 1 : 0.6,
                transition: "all 0.15s",
                flexShrink: 0,
              }}
            >
              <img loading="lazy" decoding="async"
                src={image.thumbnail || image.url}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ImageGalleryModal;
