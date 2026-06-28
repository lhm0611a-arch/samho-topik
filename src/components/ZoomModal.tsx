import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// We'll manage zoom state imperatively to map the exact pinch-zoom behavior easily.
// This is a port of the zoomImg logic.
let zoomImgCallback: ((src: string) => void) | null = null;

export const showZoomModal = (src: string) => {
  if (zoomImgCallback) zoomImgCallback(src);
};

export const ZoomModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  
  const [scale, setScale] = useState(1);
  const [baseScale, setBaseScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [baseTranslate, setBaseTranslate] = useState({ x: 0, y: 0 });
  
  const [isZoomMoving, setIsZoomMoving] = useState(false);
  const [initialPinchDist, setInitialPinchDist] = useState(0);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    zoomImgCallback = (src: string) => {
      setImgSrc(src);
      setScale(1);
      setBaseScale(1);
      setTranslate({ x: 0, y: 0 });
      setBaseTranslate({ x: 0, y: 0 });
      setIsZoomMoving(false);
      setIsOpen(true);
    };
  }, []);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      setInitialPinchDist(dist);
      setBaseScale(scale);
    } else if (e.touches.length === 1) {
      setStartPos({ x: e.touches[0].pageX, y: e.touches[0].pageY });
      setBaseTranslate({ ...translate });
    }
    setIsZoomMoving(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setIsZoomMoving(true);
    if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      const newScale = Math.min(Math.max(1, baseScale * (dist / initialPinchDist)), 5);
      setScale(newScale);
    } else if (e.touches.length === 1 && scale > 1) {
      const x = baseTranslate.x + (e.touches[0].pageX - startPos.x);
      const y = baseTranslate.y + (e.touches[0].pageY - startPos.y);
      setTranslate({ x, y });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) setBaseScale(scale);
    if (e.touches.length === 0) {
      setBaseTranslate({ ...translate });
      setTimeout(() => setIsZoomMoving(false), 100);
    }
  };

  const closeModal = () => {
    if (isZoomMoving) return;
    setIsOpen(false);
  };

  return (
    <div 
      className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 cursor-zoom-out"
      onClick={closeModal}
      onTouchMove={(e) => e.preventDefault()}
    >
      <img 
        src={imgSrc} 
        alt="Zoomed"
        className="max-w-full max-h-[90vh] object-contain rounded-sm border border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.8)] touch-none transition-transform duration-75"
        style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
};
