"use client";

import React, { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';

interface CatalogScannerProps {
  onDetected: (text: string) => void;
  onClose: () => void;
}

export default function CatalogScanner({ onDetected, onClose }: CatalogScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scannedText, setScannedText] = useState<string>("Scanning...");
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const requestRef = useRef<number>();

  useEffect(() => {
    let stream: MediaStream | null = null;

    const setupCameraAndOCR = async () => {
      // 1. Initialize Tesseract Worker
      const worker = await Tesseract.createWorker("eng");
      workerRef.current = worker;

      // 2. Start Camera
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" } // Force back camera
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setScannedText("Camera access required.");
      }
    };

    setupCameraAndOCR();

    return () => {
      // Cleanup on close
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (workerRef.current) workerRef.current.terminate();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // 3. The OCR Loop
  const captureAndRead = async () => {
    if (!videoRef.current || !canvasRef.current || !workerRef.current || isProcessing) {
      requestRef.current = requestAnimationFrame(captureAndRead);
      return;
    }

    setIsProcessing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
      // Define the target "Wide Rectangle" area
      const cropWidth = video.videoWidth * 0.8;  // 80% of width
      const cropHeight = video.videoHeight * 0.2; // 20% of height
      const cropX = (video.videoWidth - cropWidth) / 2;
      const cropY = (video.videoHeight - cropHeight) / 2;

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Draw just that cropped rectangle to the hidden canvas
      ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      // Send the canvas to Tesseract
      try {
        const { data: { text } } = await workerRef.current.recognize(canvas);
        
        // Clean up the text (remove newlines, extra spaces, keep alphanumeric and dashes)
        const cleanText = text.replace(/[^a-zA-Z0-9-]/g, '').trim();
        
        if (cleanText.length > 3) {
          setScannedText(cleanText);
        }
      } catch (err) {
        console.error("OCR Error:", err);
      }
    }
    
    setIsProcessing(false);
    
    // Add a slight delay (500ms) between scans so we don't melt the phone's CPU
    setTimeout(() => {
      requestRef.current = requestAnimationFrame(captureAndRead);
    }, 500);
  };

  // Start the loop once the video is playing
  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 bg-gray-800 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold z-10"
      >✕</button>
      
      <div className="relative w-full max-w-md aspect-[3/4] bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          onPlay={() => captureAndRead()}
          className="w-full h-full object-cover opacity-60"
        />
        
        {/* The Targeting Overlay (Wide Rectangle) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[80%] h-[20%] border-4 border-emerald-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] flex items-center justify-center relative">
            <span className="absolute -top-6 text-emerald-400 text-xs font-bold uppercase tracking-widest bg-black/50 px-2 py-1 rounded">Align Catalog Number</span>
            <div className="w-8 h-[2px] bg-emerald-500/50 absolute top-1/2 -translate-y-1/2" />
          </div>
        </div>
        
        <canvas ref={canvasRef} className="hidden" />

        {/* The Dynamic Confirmation Button */}
        <div className="absolute bottom-8 left-0 right-0 px-6 flex flex-col items-center gap-3">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Tap when correct</p>
          <button 
            onClick={() => onDetected(scannedText)}
            disabled={scannedText === "Scanning..." || scannedText.length < 3}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white py-4 rounded-xl font-black text-xl shadow-lg transition transform active:scale-95"
          >
            {scannedText}
          </button>
        </div>
      </div>
    </div>
  );
}
