import { db } from '@/lib/db';
import Sidebar from '@/components/layout/Sidebar';

export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const lastHB = await db.deviceHeartbeat.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  const isOnline = lastHB
    ? Date.now() - new Date(lastHB.createdAt).getTime() < 2 * 60 * 1000
    : false;

  return (
    <div className="app-layout">
      <Sidebar isOnline={isOnline} lastSeen={lastHB?.createdAt ?? null} />
      <main className="main-content">{children}</main>
    </div>
  );
}
