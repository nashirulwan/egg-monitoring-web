"use client";

import { useState, useEffect } from "react";
import { Database, Cpu, Thermometer, RefreshCcw } from "lucide-react";

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
            { label: "Interval Pembacaan Sensor", description: "Seberapa sering ESP32 mengirim suhu, kelembapan, dan gas", type: "number", value: 10000, unit: "ms", key: "sensor_interval_ms" },
            { label: "DHT22", description: "Sensor suhu dan kelembapan", type: "info", value: "GPIO4" },
            { label: "Sensor Gas", description: "Nilai analog gas ikut masuk ke dashboard dan sensor log", type: "info", value: "GPIO34" },
            { label: "Sensor Telur", description: "A001, A002, B001, B002 dihitung per sensor IR", type: "info", value: "18 / 19 / 21 / 22" },
        ],
    },
    {
        title: "Perangkat IoT",
        icon: Cpu,
        items: [
            { label: "Timeout Offline", description: "Perangkat dianggap offline setelah tidak ada heartbeat", type: "number", value: 2, unit: "menit", key: "offline_timeout" },
            { label: "Mode Aktuator", description: "Manual dari dashboard, Auto kembali ke logika sensor ESP32", type: "info", value: "Dashboard" },
            { label: "Batas Kipas ON", description: "Mode Auto menyalakan kipas 1 & 2 saat suhu lebih dari angka ini", type: "number", value: 28, unit: "°C", key: "fan_on_temp" },
            { label: "Batas Lampu ON", description: "Mode Auto menyalakan lampu saat suhu kurang dari angka ini", type: "number", value: 28, unit: "°C", key: "lamp_on_temp" },
            { label: "Batas Gas Tidak Aman", description: "Mode Auto menyalakan conveyor saat ADC gas sama/lebih dari angka ini", type: "number", value: 1800, unit: "ADC", key: "gas_threshold" },
            { label: "Delay Manual Aktuator", description: "Seberapa cepat ESP32 membaca tombol manual dari dashboard", type: "number", value: 1000, unit: "ms", key: "actuator_poll_ms" },
        ],
    },
    {
        title: "Database & Storage",
        icon: Database,
        items: [
            { label: "Database Driver", description: "ORM dan driver yang digunakan", type: "info", value: "Prisma ORM + PostgreSQL" },
            { label: "Database", description: "Data sensor, telur, gas, heartbeat, dan aktuator", type: "info", value: "eggmonitoring" },
            { label: "Riwayat", description: "Data dipakai untuk dashboard, grafik, sensor log, dan riwayat telur", type: "info", value: "Aktif" },
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
                    <p>Konfigurasi yang dipakai sistem monitoring</p>
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
                                        gap: 14, flexWrap: "wrap",
                                        padding: "14px 0", borderBottom: ii < section.items.length - 1 ? "1px solid var(--border-light)" : "none",
                                    }}>
                                        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.label}</div>
                                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.description}</div>
                                        </div>
                                        <div style={{ flex: "0 0 auto", minWidth: item.type === "info" ? 120 : "auto", display: "flex", justifyContent: "flex-end" }}>
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
                                                            width: 86, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)",
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
                                                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, textAlign: "right" }}>{String(item.value)}</span>
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
