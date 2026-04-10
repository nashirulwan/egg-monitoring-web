import SharedLayout from "@/components/layout/SharedLayout";
import PengaturanClient from "./PengaturanClient";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
    const settings = await db.setting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
        settingsMap[s.key] = s.value;
    }

    return (
        <SharedLayout>
            <PengaturanClient initialSettings={settingsMap} />
        </SharedLayout>
    );
}
