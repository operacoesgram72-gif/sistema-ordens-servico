import { useCallback } from "react";

export function useCamera() {
  const capture = useCallback(
    (onCapture: (dataUrl: string, mimeType: string) => void) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.setAttribute("capture", "environment");
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => onCapture(reader.result as string, file.type);
      };
      input.click();
    },
    []
  );

  return { capture };
}

export interface GpsCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

export function useGps() {
  const getLocation = useCallback((): Promise<GpsCoords> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalização não suportada neste dispositivo."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  return { getLocation };
}

export function useVibration() {
  const vibrate = useCallback((pattern: number | number[] = 200) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  return { vibrate };
}
