'use client';

import { useState } from 'react';
import { Wind, Lightbulb, Volume2, CircleDot } from 'lucide-react';

interface Actuator {
    id: string;
    name: string;
    type: string;
    state: boolean;
}

const iconMap: Record<string, { icon: React.ElementType; cls: string }> = {
    fan: { icon: Wind, cls: 'fan' },
    lamp: { icon: Lightbulb, cls: 'lamp' },
    buzzer: { icon: Volume2, cls: 'buzzer' },
    led: { icon: CircleDot, cls: 'led' },
};

const labelMap: Record<string, string> = {
    fan: 'Kipas',
    lamp: 'Lampu',
    buzzer: 'Buzzer',
    led: 'LED',
};

export default function ActuatorControls({ actuators }: { actuators: Actuator[] }) {
    const [states, setStates] = useState<Record<string, boolean>>(
        Object.fromEntries(actuators.map((a) => [a.id, a.state]))
    );
    const [loading, setLoading] = useState<Record<string, boolean>>({});

    const toggle = async (actuator: Actuator) => {
        if (loading[actuator.id]) return;
        setLoading((l) => ({ ...l, [actuator.id]: true }));

        try {
            let url = '';
            if (actuator.type === 'fan') url = '/api/actuators/fan/toggle';
            else if (actuator.type === 'buzzer') url = '/api/actuators/buzzer/toggle';
            else url = `/api/actuators/lamp/${actuator.id}/toggle`;

            const res = await fetch(url, { method: 'POST' });
            const data = await res.json();
            setStates((s) => ({ ...s, [actuator.id]: data.state }));
        } catch (err) {
            console.error('Toggle error:', err);
        } finally {
            setLoading((l) => ({ ...l, [actuator.id]: false }));
        }
    };

    return (
        <div className="chart-card">
            <div className="chart-card-header" style={{ marginBottom: 16 }}>
                <div>
                    <div className="chart-card-title">⚡ Kontrol Aktuator</div>
                    <div className="chart-card-subtitle">Fan, lampu, buzzer, LED</div>
                </div>
            </div>
            <div className="actuator-list">
                {actuators.map((a) => {
                    const { icon: Icon, cls } = iconMap[a.type] || { icon: CircleDot, cls: 'led' };
                    const isOn = states[a.id] ?? a.state;
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
                                </div>
                            </div>
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
