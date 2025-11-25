
export type Language = 'en' | 'hi' | 'bn';

export interface UploadedDocument {
  type: string;
  date: string;
  verified: boolean;
}

export interface UserProfile {
  fullName: string;
  dateOfBirth: string;
  address: string;
  idNumber: string; // e.g., Aadhar/PAN
  phoneNumber: string;
  email: string;
  documents: UploadedDocument[];
}

export interface FormRecord {
  id: string;
  date: string;
  status: 'completed';
}

export interface FormFieldOverlay {
  fieldName: string;
  valueToFill: string;
  boundingBox: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
}

export interface FormTemplate {
  id: string;
  name: string;
  createdAt: string;
  overlays: FormFieldOverlay[];
}

export enum AppView {
  LANGUAGE_SELECT = 'LANGUAGE_SELECT',
  ONBOARDING = 'ONBOARDING',
  DASHBOARD = 'DASHBOARD',
  SCANNER = 'SCANNER',
  IMAGE_EDITOR = 'IMAGE_EDITOR',
}

export enum DashboardTab {
  HOME = 'HOME',
  DOCUMENTS = 'DOCUMENTS',
  HISTORY = 'HISTORY',
  TEMPLATES = 'TEMPLATES',
}

export interface ScanResult {
  image: string; // base64
  overlays: FormFieldOverlay[];
}
