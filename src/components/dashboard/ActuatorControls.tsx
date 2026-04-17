'use client';

import { useState } from 'react';
import { Wind, Lightbulb, CircleDot, RotateCw } from 'lucide-react';

interface Actuator {
    id: string;
    name: string;
    type: string;
    state: boolean;
    manualOverride: boolean;
}

const iconMap: Record<string, { icon: React.ElementType; cls: string }> = {
    fan: { icon: Wind, cls: 'fan' },
    lamp: { icon: Lightbulb, cls: 'lamp' },
    led: { icon: CircleDot, cls: 'led' },
    conveyor: { icon: RotateCw, cls: 'fan' },
};

export default function ActuatorControls({ actuators }: { actuators: Actuator[] }) {
    const [states, setStates] = useState<Record<string, boolean>>(
        Object.fromEntries(actuators.map((a) => [a.id, a.state]))
    );
    const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>(
        Object.fromEntries(actuators.map((a) => [a.id, a.manualOverride]))
    );
    const [loading, setLoading] = useState<Record<string, boolean>>({});

    const toggle = async (actuator: Actuator) => {
        if (loading[actuator.id]) return;
        setLoading((l) => ({ ...l, [actuator.id]: true }));

        try {
            const res = await fetch(`/api/actuators/${actuator.id}/toggle`, { method: 'POST' });
            const data = await res.json();
            setStates((s) => ({ ...s, [actuator.id]: data.state }));
            setManualOverrides((s) => ({ ...s, [actuator.id]: data.manualOverride }));
        } catch (err) {
            console.error('Toggle error:', err);
        } finally {
            setLoading((l) => ({ ...l, [actuator.id]: false }));
        }
    };

    const setAuto = async (actuator: Actuator) => {
        if (loading[actuator.id]) return;
        setLoading((l) => ({ ...l, [actuator.id]: true }));

        try {
            const res = await fetch(`/api/actuators/${actuator.id}/auto`, { method: 'POST' });
            const data = await res.json();
            setStates((s) => ({ ...s, [actuator.id]: data.state }));
            setManualOverrides((s) => ({ ...s, [actuator.id]: data.manualOverride }));
        } catch (err) {
            console.error('Auto mode error:', err);
        } finally {
            setLoading((l) => ({ ...l, [actuator.id]: false }));
        }
    };

    return (
        <div className="chart-card">
            <div className="chart-card-header" style={{ marginBottom: 16 }}>
                <div>
                    <div className="chart-card-title">⚡ Kontrol Aktuator</div>
                    <div className="chart-card-subtitle">Kipas 1, kipas 2, lampu, conveyor</div>
                </div>
            </div>
            <div className="actuator-list">
                {actuators.map((a) => {
                    const { icon: Icon, cls } = iconMap[a.type] || { icon: CircleDot, cls: 'led' };
                    const isOn = states[a.id] ?? a.state;
                    const isManual = manualOverrides[a.id] ?? a.manualOverride;
                    const isLoading = loading[a.id];

                    return (
                        <div className="actuator-item" key={a.id}>
                            <div className={`actuator-icon ${cls}`}>
                                <Icon size={17} />
                            </div>
                            <div className="actuator-info">
                                <div className="actuator-name">{a.name}</div>
                                <div className="actuator-state">
                                    {isLoading ? 'Mengubah...' : isOn ? '● Menyala' : '○ Mati'}
                                    {' · '}
                                    {isManual ? 'Manual' : 'Auto'}
                                </div>
                            </div>
                            {isManual && (
                                <button
                                    type="button"
                                    onClick={() => setAuto(a)}
                                    disabled={isLoading}
                                    style={autoButtonStyle}
                                >
                                    Auto
                                </button>
                            )}
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={isOn}
                                    onChange={() => toggle(a)}
                                    disabled={isLoading}
                                />
                                <span className="toggle-slider" />
                            </label>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const autoButtonStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--bg)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
    padding: '5px 8px',
};
