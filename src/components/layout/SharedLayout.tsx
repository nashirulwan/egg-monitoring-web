import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import Sidebar from '@/components/layout/Sidebar';

export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const wallClock = new Date();
  const [lastHB, dbTimeResult] = await Promise.all([
    db.deviceHeartbeat.findFirst({
      where: { createdAt: { lte: wallClock } },
      orderBy: { createdAt: 'desc' },
    }),
    db.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT NOW() as now`),
  ]);
  const now = dbTimeResult[0]?.now;
  const isOnline = lastHB && now
    ? now.getTime() - lastHB.createdAt.getTime() < 2 * 60 * 1000
    : false;

  return (
    <div className="app-layout">
      <Sidebar 
        isOnline={isOnline} 
        lastSeen={lastHB?.createdAt ? lastHB.createdAt.toISOString() : null} 
      />
      <main className="main-content">{children}</main>
    </div>
  );
}
