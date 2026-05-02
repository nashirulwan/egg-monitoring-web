'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Thermometer, Egg, Cpu, Bell, Settings, Brain } from 'lucide-react';

interface SidebarProps {
    isOnline: boolean;
    lastSeen: string | null;
}

const menuItems = [
    {
        label: 'Menu', items: [
            { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
            { href: '/sensor-log', icon: Thermometer, label: 'Sensor Log' },
            { href: '/riwayat-telur', icon: Egg, label: 'Riwayat Telur' },
            { href: '/prediksi-ai', icon: Brain, label: 'Prediksi AI' },
        ]
    },
    {
        label: 'Sistem', items: [
            { href: '/perangkat', icon: Cpu, label: 'Perangkat' },
            { href: '/notifikasi', icon: Bell, label: 'Notifikasi' },
            { href: '/pengaturan', icon: Settings, label: 'Pengaturan' },
        ]
    },
];

export default function Sidebar({ isOnline, lastSeen }: SidebarProps) {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">🥚</div>
                <div className="sidebar-logo-text">
                    <h1>EggMonitor</h1>
                    <p>v1.0 · Kandang Utama</p>
                </div>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map((section) => (
                    <div key={section.label}>
                        <div className="sidebar-section-label">{section.label}</div>
                        {section.items.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                                >
                                    <item.icon className="icon" size={18} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-device-status">
                    <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                    <div className="status-info">
                        <p>ESP32-Kandang-01</p>
                        <span>
                            {isOnline
                                ? 'Online'
                                : `Offline · ${lastSeen ? 'terakhir ' + new Date(lastSeen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'tidak diketahui'}`}
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
