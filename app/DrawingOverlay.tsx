"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

type Props = {
  onClose: () => void;
};

const drawingStateKey = "__wolfButtonsDrawing";
const lineWidth = 5;

export default function DrawingOverlay({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const closeFallbackRef = useRef<number | null>(null);
  const closingByHistoryRef = useRef(false);
  const pushedHistoryRef = useRef(false);
  const scrollYRef = useRef(0);
  const bodyStyleRef = useRef({
    overflow: "",
    position: "",
    top: "",
    width: "",
    userSelect: "",
  });

  const setupContext = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) return null;

    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const color =
      getComputedStyle(document.documentElement).getPropertyValue("--danger").trim() || "#ff4d4f";

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";

    return context;
  }, []);

  const clearCanvas = useCallback(() => {
    const context = setupContext();
    context?.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }, [setupContext]);

  useEffect(() => {
    const body = document.body;
    const canvas = canvasRef.current;
    scrollYRef.current = window.scrollY;
    bodyStyleRef.current = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      userSelect: body.style.userSelect,
    };

    clearCanvas();

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.width = "100%";
    body.style.userSelect = "none";

    window.history.pushState(
      { ...(window.history.state || {}), [drawingStateKey]: true },
      "",
      window.location.href
    );
    pushedHistoryRef.current = true;

    const closeFromHistory = () => {
      if (!pushedHistoryRef.current) return;
      closingByHistoryRef.current = true;
      pushedHistoryRef.current = false;
      clearCanvas();
      onClose();
    };

    window.addEventListener("resize", clearCanvas);
    window.addEventListener("orientationchange", clearCanvas);
    window.addEventListener("popstate", closeFromHistory);

    return () => {
      if (activePointerIdRef.current !== null && canvas?.hasPointerCapture(activePointerIdRef.current)) {
        canvas.releasePointerCapture(activePointerIdRef.current);
      }

      activePointerIdRef.current = null;
      window.removeEventListener("resize", clearCanvas);
      window.removeEventListener("orientationchange", clearCanvas);
      window.removeEventListener("popstate", closeFromHistory);

      if (closeFallbackRef.current !== null) {
        window.clearTimeout(closeFallbackRef.current);
      }

      clearCanvas();

      body.style.overflow = bodyStyleRef.current.overflow;
      body.style.position = bodyStyleRef.current.position;
      body.style.top = bodyStyleRef.current.top;
      body.style.width = bodyStyleRef.current.width;
      body.style.userSelect = bodyStyleRef.current.userSelect;
      window.scrollTo(0, scrollYRef.current);

      if (!closingByHistoryRef.current && window.history.state?.[drawingStateKey]) {
        window.history.replaceState(
          { ...window.history.state, [drawingStateKey]: false },
          "",
          window.location.href
        );
      }
    };
  }, [clearCanvas, onClose]);

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== null) return;

    event.preventDefault();
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    const context = canvasRef.current?.getContext("2d");
    if (!context) return;

    const point = getPoint(event);
    context.beginPath();
    context.arc(point.x, point.y, lineWidth / 2, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;

    event.preventDefault();
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;

    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;

    event.preventDefault();
    const context = canvasRef.current?.getContext("2d");
    context?.closePath();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    activePointerIdRef.current = null;
  };

  const close = () => {
    clearCanvas();

    if (!pushedHistoryRef.current) {
      onClose();
      return;
    }

    window.history.back();
    closeFallbackRef.current = window.setTimeout(() => {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        onClose();
      }
    }, 300);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        aria-hidden="true"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
      />
      <div className="drawing-toolbar" aria-label="畫圖工具列">
        <button
          type="button"
          className="drawing-tool-button"
          aria-label="清除全部筆跡"
          onClick={clearCanvas}
        >
          🗑️
        </button>
        <button
          type="button"
          className="drawing-tool-button"
          aria-label="退出畫圖模式"
          onClick={close}
        >
          ❌
        </button>
      </div>
    </>
  );
}
