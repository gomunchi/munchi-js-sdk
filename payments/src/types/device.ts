export enum AppReaderStatus {
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  OFFLINE = "OFFLINE",
  DISCONNECTED = "DISCONNECTED",
}

export interface AppReader {
  id: string;
  serialNumber: string | null;
  label: string;
  status: AppReaderStatus;
  batteryLevel?: number | null;
  providerRawData?: unknown;
}
