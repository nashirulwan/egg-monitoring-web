'use client';

import { useState } from 'react';
import { Wifi, WifiOff, Cpu, Wind, Lightbulb, Volume2, CircleDot, Signal, HardDrive, Clock } from 'lucide-react';

interface Actuator {
    id: string;
    name: string;
    type: string;
    pin: number | null;
    state: boolean;
}

interface Device {
    id: string;
    name: string;
    type: string;
    location: string | null;
    isActive: boolean;
    isOnline: boolean;
    lastSeen: string | null;
    rssi: number | null;
    freeHeap: number | null;
    uptime: number | null;
    actuators: Actuator[];
}

function formatUptime(seconds: number | null): string {
    if (!seconds) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    if (d > 0) return `${d} hari ${h} jam`;
    return `${h} jam`;
}

const actuatorIcons: Record<string, React.ElementType> = {
    fan: Wind, lamp: Lightbulb, buzzer: Volume2, led: CircleDot,
};

export default function PerangkatClient({ devices }: { devices: Device[] }) {
    const [toggleLoading, setToggleLoading] = useState<Record<string, boolean>>({});
    const [actuatorStates, setActuatorStates] = useState<Record<string, boolean>>(
        Object.fromEntries(devices.flatMap((d) => d.actuators.map((a) => [a.id, a.state])))
    );

    const toggleActuator = async (a: Actuator) => {
        if (toggleLoading[a.id]) return;
        setToggleLoading((l) => ({ ...l, [a.id]: true }));
        try {
            let url = '';
            if (a.type === 'fan') url = '/api/actuators/fan/toggle';
            else if (a.type === 'buzzer') url = '/api/actuators/buzzer/toggle';
            else url = `/api/actuators/lamp/${a.id}/toggle`;
            const res = await fetch(url, { method: 'POST' });
            const data = await res.json();
            setActuatorStates((s) => ({ ...s, [a.id]: data.state }));
        } catch { } finally {
            setToggleLoading((l) => ({ ...l, [a.id]: false }));
        }
    };

    return (
        <>
            <div className="page-header">
                <div className="page-title">
                    <h2>Perangkat</h2>
                    <p>Detail perangkat IoT dan kontrol aktuator</p>
                </div>
            </div>

            {devices.map((device) => (
                <div key={device.id} style={{ marginBottom: 24 }}>
                    {/* Device Info Card */}
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(212,160,23,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Cpu size={22} style={{ color: 'var(--primary)' }} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{device.name}</h3>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{device.type} · {device.location}</p>
                                </div>
                            </div>
                            <span className={`badge ${device.isOnline ? 'success' : 'danger'}`} style={{ fontSize: 13, padding: '5px 14px' }}>
                                {device.isOnline ? <><Wifi size={13} /> Online</> : <><WifiOff size={13} /> Offline</>}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                            <InfoCard icon={Signal} label="Sinyal WiFi" value={device.rssi ? `${device.rssi} dBm` : '—'} />
                            <InfoCard icon={Clock} label="Uptime" value={formatUptime(device.uptime)} />
                            <InfoCard icon={HardDrive} label="Free Heap" value={device.freeHeap ? `${(device.freeHeap / 1024).toFixed(0)} KB` : '—'} />
                            <InfoCard icon={Cpu} label="Terakhir Online" value={device.lastSeen ? new Date(device.lastSeen).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'} />
                        </div>
                    </div>

                    {/* Actuators Card */}
                    <div className="card">
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                            ⚡ Aktuator ({device.actuators.length})
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                            {device.actuators.map((a) => {
                                const Icon = actuatorIcons[a.type] || CircleDot;
                                const isOn = actuatorStates[a.id] ?? a.state;
                                return (
                                    <div key={a.id} className="actuator-item">
                                        <div className={`actuator-icon ${a.type}`}><Icon size={17} /></div>
                                        <div className="actuator-info">
                                            <div className="actuator-name">{a.name}</div>
                                            <div className="actuator-state">
                                                Pin {a.pin ?? '—'} · {toggleLoading[a.id] ? 'Mengubah...' : isOn ? '● Menyala' : '○ Mati'}
                                            </div>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={isOn} onChange={() => toggleActuator(a)} disabled={toggleLoading[a.id]} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ))}
        </>
    );
}

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        </div>
    );
}
