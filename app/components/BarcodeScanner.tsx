'use client';

import { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// We simplified this to only expect what page.tsx is sending
interface BarcodeScannerProps {
  onDetected: (code: string) => void;
}

export default function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, 
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Success! Stop the camera and pass the code up to page.tsx
            html5QrCode.stop().then(() => {
              onDetected(decodedText);
            }).catch(console.error);
          },
          (errorMessage) => {
            // Ignore standard scanning background errors
          }
        );
      } catch (err) {
        console.error("Camera error:", err);
        setScanError("Failed to start camera. Make sure permissions are granted.");
      }
    };

    startScanner();

    // Cleanup when the user closes the modal
    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onDetected]);

  // Notice we removed the fixed background wrapper, because page.tsx handles it now!
  return (
    <div className="w-full bg-black">
      {scanError ? (
        <div className="p-8 text-center text-red-600 font-medium bg-white">
          {scanError}
        </div>
      ) : (
        <div id="reader" className="w-full min-h-[300px]"></div>
      )}
    </div>
  );
}
