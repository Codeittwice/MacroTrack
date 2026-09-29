import { useEffect, useRef, useState } from 'react';
import { Camera, Search } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
import { Button, Input } from '@/components/ui';
import type { FoodItem } from '@/db/types';
import { getFoodByBarcode } from '@/lib/food-sources/search';

function cleanBarcode(value: string): string {
  return value.replace(/[\s-]/g, '');
}

export function BarcodeTab({ onSelect }: { onSelect: (food: FoodItem) => void }) {
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [scanning, setScanning] = useState(false);
  const controlsRef = useRef<IScannerControls | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanningRef = useRef(false);

  const stopScanner = () => {
    scanningRef.current = false;
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => controlsRef.current?.stop(), []);

  const lookup = async (rawBarcode = barcode) => {
    const code = cleanBarcode(rawBarcode);
    if (!/^\d{8,14}$/.test(code)) {
      setStatus('Enter an 8 to 14 digit EAN or UPC.');
      return;
    }
    setLookingUp(true);
    setStatus(null);
    try {
      const food = await getFoodByBarcode(code);
      if (food) onSelect(food);
      else setStatus('No product found for this barcode.');
    } catch {
      setStatus('Barcode lookup is unavailable right now.');
    } finally {
      setLookingUp(false);
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
      setStatus('Camera scanning is not supported in this browser.');
      return;
    }
    setStatus(null);
    setScanning(true);
    scanningRef.current = true;
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoRef.current,
        (result) => {
          if (!result || !scanningRef.current) return;
          const code = result.getText();
          stopScanner();
          setBarcode(code);
          void lookup(code);
        },
      );
      controlsRef.current = controls;
      if (!scanningRef.current) controls.stop();
    } catch {
      scanningRef.current = false;
      setScanning(false);
      setStatus('Camera access was unavailable. Check the browser permission and try again.');
    }
  };

  return <div className="flex flex-col gap-4">
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <Input aria-label="Barcode" inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Enter EAN or UPC" className="pl-10" autoFocus />
    </div>
    <Button variant="primary" disabled={lookingUp} onClick={() => void lookup()}>{lookingUp ? 'Looking up...' : 'Find product'}</Button>
    <div className="border-t border-border pt-4">
      <div className={scanning ? 'mb-3' : 'hidden'}><video ref={videoRef} className="aspect-video w-full rounded-xl bg-black object-cover" muted playsInline /></div>
      {scanning ? <Button variant="secondary" className="w-full" onClick={stopScanner}>Stop camera</Button> : <Button variant="secondary" className="w-full" onClick={() => void startCamera()}><Camera size={18} /> Start camera</Button>}
    </div>
    {status && <div role="status" className="text-sm text-muted">{status}</div>}
  </div>;
}
