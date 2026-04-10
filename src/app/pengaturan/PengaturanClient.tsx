"use client";

import { useState, useEffect } from "react";
import { Database, Cpu, Thermometer, Shield, RefreshCcw } from "lucide-react";

interface SettingsSection {
    title: string;
    icon: React.ElementType;
    items: SettingItem[];
}

interface SettingItem {
    label: string;
    description: string;
    type: "toggle" | "number" | "text" | "info";
    value: string | number | boolean;
    unit?: string;
    key?: string; // DB key for persistence
}

const defaultSettings: SettingsSection[] = [
    {
        title: "Sensor & Monitoring",
        icon: Thermometer,
        items: [
            { label: "Interval Pembacaan Sensor", description: "Seberapa sering sensor DHT11 mengirim data", type: "number", value: 10, unit: "menit", key: "sensor_interval" },
            { label: "Batas Suhu Atas", description: "Alert jika suhu melebihi nilai ini", type: "number", value: 39, unit: "°C", key: "temp_upper" },
            { label: "Batas Suhu Bawah", description: "Alert jika suhu di bawah nilai ini", type: "number", value: 36, unit: "°C", key: "temp_lower" },
            { label: "Target Kelembapan", description: "Kelembapan ideal kandang", type: "number", value: 55, unit: "%", key: "humidity_target" },
        ],
    },
    {
        title: "Perangkat IoT",
        icon: Cpu,
        items: [
            { label: "Heartbeat Interval", description: "Interval heartbeat ESP32 ke server", type: "number", value: 30, unit: "detik", key: "heartbeat_interval" },
            { label: "Timeout Offline", description: "Perangkat dianggap offline setelah tidak ada heartbeat", type: "number", value: 2, unit: "menit", key: "offline_timeout" },
            { label: "Auto-restart Fan", description: "Otomatis nyalakan kipas saat suhu > batas atas", type: "toggle", value: true, key: "auto_fan" },
            { label: "Auto-alarm Buzzer", description: "Otomatis buzzer saat suhu kritis", type: "toggle", value: false, key: "auto_buzzer" },
        ],
    },
    {
        title: "Database & Storage",
        icon: Database,
        items: [
            { label: "Database Driver", description: "ORM dan driver yang digunakan", type: "info", value: "Prisma ORM + PostgreSQL" },
            { label: "Lokasi Database", description: "Path file database", type: "info", value: "eggmonitoring (PostgreSQL)" },
            { label: "Retensi Data Sensor", description: "Berapa lama data sensor disimpan", type: "number", value: 90, unit: "hari", key: "data_retention" },
        ],
    },
    {
        title: "Jaringan & Keamanan",
        icon: Shield,
        items: [
            { label: "API Key IoT", description: "API key untuk autentikasi perangkat IoT", type: "text", value: "belum dikonfigurasi", key: "iot_api_key" },
            { label: "CORS Allowed Origins", description: "Domain yang diizinkan mengakses API", type: "text", value: "*", key: "cors_origins" },
        ],
    },
];

function applySavedSettings(settings: SettingsSection[], saved: Record<string, string>): SettingsSection[] {
    return settings.map((section) => ({
        ...section,
        items: section.items.map((item) => {
            if (!item.key || !(item.key in saved)) return item;
            const raw = saved[item.key];
            if (item.type === "toggle") return { ...item, value: raw === "true" };
            if (item.type === "number") return { ...item, value: Number(raw) };
            return { ...item, value: raw };
        }),
    }));
}

export default function PengaturanClient({ initialSettings }: { initialSettings?: Record<string, string> }) {
    const [settings, setSettings] = useState<SettingsSection[]>(
        initialSettings ? applySavedSettings(defaultSettings, initialSettings) : defaultSettings
    );
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    // Re-sync when initialSettings changes (after hydration)
    useEffect(() => {
        if (initialSettings) {
            setSettings(applySavedSettings(defaultSettings, initialSettings));
        }
    }, [initialSettings]);

    const updateSetting = (sectionIdx: number, itemIdx: number, newValue: string | number | boolean) => {
        setSettings((prev) => {
            return prev.map((section, si) => {
                if (si !== sectionIdx) return section;
                return {
                    ...section,
                    items: section.items.map((item, ii) => {
                        if (ii !== itemIdx) return item;
                        return { ...item, value: newValue };
                    }),
                };
            });
        });
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const payload: Record<string, string | number | boolean> = {};
        settings.forEach((section) => {
            section.items.forEach((item) => {
                if (item.key) {
                    payload[item.key] = item.value;
                }
            });
        });

        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch {
            // ignore
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="page-header">
                <div className="page-title">
                    <h2>Pengaturan</h2>
                    <p>Konfigurasi sistem monitoring</p>
                </div>
                <button onClick={handleSave} disabled={saving} style={{
                    padding: "8px 20px", borderRadius: 8, fontWeight: 600, fontSize: 13,
                    background: saved ? "var(--success)" : "var(--primary)", color: "#fff",
                    border: "none", cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.2s ease",
                }}>
                    {saving ? <><RefreshCcw size={14} className="animate-spin" /> Menyimpan...</> : saved ? "✓ Tersimpan" : <><RefreshCcw size={14} /> Simpan</>}
                </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {settings.map((section, si) => {
                    const SectionIcon = section.icon;
                    return (
                        <div className="card" key={si}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(212,160,23,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <SectionIcon size={18} style={{ color: "var(--primary)" }} />
                                </div>
                                <h3 style={{ fontSize: 15, fontWeight: 700 }}>{section.title}</h3>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                                {section.items.map((item, ii) => (
                                    <div key={ii} style={{
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                        padding: "14px 0", borderBottom: ii < section.items.length - 1 ? "1px solid var(--border-light)" : "none",
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.label}</div>
                                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.description}</div>
                                        </div>
                                        <div style={{ flexShrink: 0, marginLeft: 20 }}>
                                            {item.type === "toggle" ? (
                                                <label className="toggle-switch">
                                                    <input type="checkbox" checked={item.value as boolean} onChange={(e) => updateSetting(si, ii, e.target.checked)} />
                                                    <span className="toggle-slider" />
                                                </label>
                                            ) : item.type === "number" ? (
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <input
                                                        type="number"
                                                        value={item.value as number}
                                                        onChange={(e) => updateSetting(si, ii, Number(e.target.value))}
                                                        style={{
                                                            width: 70, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)",
                                                            fontSize: 13, textAlign: "right", background: "var(--bg)", color: "var(--text-primary)",
                                                            fontWeight: 600, outline: "none",
                                                        }}
                                                    />
                                                    {item.unit && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.unit}</span>}
                                                </div>
                                            ) : item.type === "text" ? (
                                                <input
                                                    type="text"
                                                    value={item.value as string}
                                                    onChange={(e) => updateSetting(si, ii, e.target.value)}
                                                    style={{
                                                        width: 200, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)",
                                                        fontSize: 13, background: "var(--bg)", color: "var(--text-primary)", outline: "none",
                                                    }}
                                                />
                                            ) : (
                                                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>{String(item.value)}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
