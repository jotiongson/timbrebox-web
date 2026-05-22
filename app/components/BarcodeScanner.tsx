'use client';

import { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onScanSuccess: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    // We use the core Html5Qrcode class instead of the UI wrapper
    const html5QrCode = new Html5Qrcode("reader");

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, // This explicitly forces the rear camera
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Success! Stop the camera and send the data back
            html5QrCode.stop().then(() => {
              onScanSuccess(decodedText);
            }).catch(console.error);
          },
          (errorMessage) => {
            // The scanner throws background errors constantly when searching for a code. We ignore them.
          }
        );
      } catch (err) {
        console.error("Camera error:", err);
        setScanError("Failed to start camera. Make sure permissions are granted.");
      }
    };

    startScanner();

    // Cleanup: shut down the camera if the user clicks "Close"
    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
        <div className="p-4 bg-gray-900 flex justify-between items-center">
          <h3 className="text-white font-bold tracking-wide">Scan Barcode</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white font-bold px-3 py-1 bg-gray-800 rounded-lg"
          >
            Close
          </button>
        </div>
        
        {scanError ? (
          <div className="p-8 text-center text-red-600 font-medium">
            {scanError}
          </div>
        ) : (
          <div id="reader" className="w-full bg-black min-h-[300px]"></div>
        )}
      </div>
    </div>
  );
}
