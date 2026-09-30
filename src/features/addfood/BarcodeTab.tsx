import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, ScanBarcode, Search } from 'lucide-react';
import clsx from 'clsx';
import type { IScannerControls } from '@zxing/browser';
import { Button, Input } from '@/components/ui';
import type { FoodItem } from '@/db/types';
import { getFoodByBarcode } from '@/lib/food-sources/search';

function cleanBarcode(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/** What the scanner is doing, shown on the camera frame. */
type Phase = { kind: 'idle' } | { kind: 'scanning' } | { kind: 'detected'; code: string } | { kind: 'found'; name: string } | { kind: 'missing'; code: string };

/** How long the green "found" frame stays visible before the amount screen opens. */
const FOUND_FLASH_MS = 600;

export function BarcodeTab({ onSelect }: { onSelect: (food: FoodItem) => void }) {
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const controlsRef = useRef<IScannerControls | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanningRef = useRef(false);
  const cameraOn = phase.kind === 'scanning' || phase.kind === 'detected' || phase.kind === 'found';

  const stopScanner = (next: Phase = { kind: 'idle' }) => {
    scanningRef.current = false;
    controlsRef.current?.stop();
    controlsRef.current = null;
    setPhase(next);
  };

  useEffect(() => () => controlsRef.current?.stop(), []);

  const lookup = async (rawBarcode = barcode, fromCamera = false) => {
    const code = cleanBarcode(rawBarcode);
    if (!/^\d{8,14}$/.test(code)) {
      setStatus('Enter an 8 to 14 digit EAN or UPC.');
      if (fromCamera) stopScanner();
      return;
    }
    setLookingUp(true);
    setStatus(null);
    try {
      const food = await getFoodByBarcode(code);
      if (food && fromCamera) {
        setPhase({ kind: 'found', name: food.nameEn ?? food.name });
        window.setTimeout(() => { stopScanner(); onSelect(food); }, FOUND_FLASH_MS);
      } else if (food) {
        onSelect(food);
      } else {
        if (fromCamera) stopScanner({ kind: 'missing', code });
        setStatus(`Barcode ${code} is not in the product database yet. Create it under New food, or scan the nutrition label there.`);
      }
    } catch {
      if (fromCamera) stopScanner();
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
    setPhase({ kind: 'scanning' });
    scanningRef.current = true;
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoRef.current,
        (result) => {
          if (!result || !scanningRef.current) return;
          scanningRef.current = false; // one detection per scan
          const code = result.getText();
          navigator.vibrate?.(60);
          setBarcode(code);
          setPhase({ kind: 'detected', code });
          void lookup(code, true);
        },
      );
      controlsRef.current = controls;
      // Stopped (or already read a code) while the camera was still starting.
      if (!scanningRef.current) controls.stop();
    } catch {
      scanningRef.current = false;
      setPhase({ kind: 'idle' });
      setStatus('Camera access was unavailable. Check the camera permission and try again.');
    }
  };

  const frameColor = phase.kind === 'found' ? 'border-success' : phase.kind === 'detected' ? 'border-primary' : 'border-white/70';

  return <div className="flex flex-col gap-4">
    <div className={cameraOn ? 'relative' : 'hidden'}>
      <video ref={videoRef} className="aspect-video w-full rounded-xl bg-black object-cover" muted playsInline />
      {/* Scan frame: a moving line while searching, primary once a code is read, green when the product is found. */}
      <div aria-hidden className={clsx('pointer-events-none absolute inset-x-[12%] inset-y-[22%] rounded-xl border-2 transition-colors', frameColor)}>
        {phase.kind === 'scanning' && <div className="scan-line absolute inset-x-2 h-0.5 rounded bg-danger/80" />}
      </div>
      <div role="status" className="absolute inset-x-0 bottom-2 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-bg/85 px-3 py-1 text-xs">
        {phase.kind === 'scanning' && <><ScanBarcode size={14} /> Point the camera at a barcode</>}
        {phase.kind === 'detected' && <><Loader2 size={14} className="animate-spin" /> Barcode {phase.code} read, looking it up…</>}
        {phase.kind === 'found' && <span className="flex items-center gap-1.5 text-success"><Check size={14} /> Found: {phase.name}</span>}
      </div>
    </div>
    {cameraOn
      ? <Button variant="secondary" className="w-full" onClick={() => stopScanner()}>Stop camera</Button>
      : <Button variant="primary" size="lg" className="w-full" onClick={() => void startCamera()}><Camera size={18} /> {phase.kind === 'missing' ? 'Scan another barcode' : 'Scan with camera'}</Button>}
    <div className="border-t border-border pt-4">
      <div className="relative mb-2">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <Input aria-label="Barcode" inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Or type the EAN / UPC" className="pl-10" />
      </div>
      <Button variant="secondary" className="w-full" disabled={lookingUp} onClick={() => void lookup()}>{lookingUp && !cameraOn ? 'Looking up...' : 'Find product'}</Button>
    </div>
    {status && <div role="status" className="text-sm text-muted">{status}</div>}
  </div>;
}
