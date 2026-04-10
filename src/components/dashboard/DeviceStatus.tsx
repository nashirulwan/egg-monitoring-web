'use client';

import { Wifi, WifiOff, Cpu, Battery } from 'lucide-react';

interface Device {
    id: string;
    name: string;
    type: string;
    location: string | null;
    isOnline: boolean;
    lastSeen: string | null;
    rssi: number | null;
    freeHeap: number | null;
    uptime: number | null;
}

function formatUptime(seconds: number | null): string {
    if (!seconds) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}h ${h}j`;
    if (h > 0) return `${h}j ${m}m`;
    return `${m}m`;
}

function rssiLabel(rssi: number | null): string {
    if (!rssi) return '—';
    if (rssi > -50) return `${rssi} dBm (Sangat Kuat)`;
    if (rssi > -65) return `${rssi} dBm (Kuat)`;
    if (rssi > -75) return `${rssi} dBm (Sedang)`;
    return `${rssi} dBm (Lemah)`;
}

export default function DeviceStatus({ devices }: { devices: Device[] }) {
    const device = devices[0];
    if (!device) return null;

    return (
        <div className="chart-card">
            <div className="chart-card-header" style={{ marginBottom: 16 }}>
                <div>
                    <div className="chart-card-title">📡 Status Perangkat</div>
                    <div className="chart-card-subtitle">{device.location ?? 'Kandang'}</div>
                </div>
                <span className={`badge ${device.isOnline ? 'success' : 'danger'}`}>
                    {device.isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {device.isOnline ? 'Online' : 'Offline'}
                </span>
            </div>

            <div className="device-card-body">
                <div className="device-stat">
                    <span className="device-stat-label">Nama Perangkat</span>
                    <span className="device-stat-value">{device.name}</span>
                </div>
                <div className="device-stat">
                    <span className="device-stat-label">Tipe</span>
                    <span className="device-stat-value">{device.type}</span>
                </div>
                <div className="device-stat">
                    <span className="device-stat-label">Sinyal WiFi</span>
                    <span className="device-stat-value">{rssiLabel(device.rssi)}</span>
                </div>
                <div className="device-stat">
                    <span className="device-stat-label">Uptime</span>
                    <span className="device-stat-value">{formatUptime(device.uptime)}</span>
                </div>
                <div className="device-stat">
                    <span className="device-stat-label">Free Heap</span>
                    <span className="device-stat-value">
                        {device.freeHeap ? `${(device.freeHeap / 1024).toFixed(0)} KB` : '—'}
                    </span>
                </div>
                <div className="device-stat">
                    <span className="device-stat-label">Terakhir Online</span>
                    <span className="device-stat-value">
                        {device.lastSeen
                            ? new Date(device.lastSeen).toLocaleString('id-ID', {
                                day: '2-digit', month: 'short',
                                hour: '2-digit', minute: '2-digit',
                            })
                            : '—'}
                    </span>
                </div>
            </div>
        </div>
    );
}
