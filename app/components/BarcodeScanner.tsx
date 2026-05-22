'use client';

import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize the scanner
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 150 } },
      false
    );

    // What to do when a barcode is found
    const handleSuccess = (decodedText: string) => {
      scanner.clear(); // Instantly shut off the camera
      onScanSuccess(decodedText); // Send the barcode back to the dashboard
    };

    // Ignore background noise/blur frames
    const handleError = (err: any) => {
      // html5-qrcode throws errors constantly when it doesn't see a barcode
      // We just swallow them quietly, but we log true permission errors
      if (err?.message?.includes('NotAllowedError')) {
        setScanError('Camera permission denied.');
      }
    };

    scanner.render(handleSuccess, handleError);

    // Cleanup function: turn off the camera if the user closes the modal
    return () => {
      scanner.clear().catch(console.error);
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
            <p className="text-sm text-gray-500 mt-2">Please allow camera access in your browser settings.</p>
          </div>
        ) : (
          <div id="reader" className="w-full bg-black"></div>
        )}
      </div>
    </div>
  );
}