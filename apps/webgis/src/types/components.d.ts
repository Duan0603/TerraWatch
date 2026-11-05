import { ReactNode } from 'react';
import { MountainLocation, CameraPreset } from './geospatial';

export interface GeoEvent {
  id: string;
  location: string;
  risk?: 'critical' | 'extreme' | 'high' | 'moderate' | 'low';
  status?: string;
  polygon?: [number, number][];
  lat?: number;
  lng?: number;
  rainfall24h?: number;
  slopeDeg?: number;
  verifiedAt?: string;
  reportedBy?: string;
  description?: string;
}

export interface MapViewerProps {
  events?: GeoEvent[];
  selectedEvent?: GeoEvent | null;
  onSelectEvent?: (event: GeoEvent) => void;
}

export interface LocationSelectorProps {
  selectedLocationId?: string;
  onSelectLocation?: (location: MountainLocation) => void;
}

export interface BroadcastPayload {
  title: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  targetProvince: string;
  channels: ('sms' | 'fcm' | 'siren')[];
  enableSiren: boolean;
  affectedDistricts?: string[];
  validUntil?: string;
  issuedBy?: string;
}

export interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: GeoEvent | null;
  allEvents?: GeoEvent[];
  currentUser?: {
    id?: string;
    fullName?: string;
    email?: string;
    role?: 'ADMIN' | 'DISPATCHER' | 'OBSERVER';
  } | null;
  onBroadcastSuccess?: (result: any) => void;
}

export interface MapErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}
