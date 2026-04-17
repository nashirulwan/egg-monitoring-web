import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const defaultSettingValues: Record<string, string> = {
  offline_timeout: "2",
  sensor_interval_ms: "10000",
  fan_on_temp: "28",
  lamp_on_temp: "28",
  gas_threshold: "1800",
  actuator_poll_ms: "1000",
};

const allowedSettingKeys = new Set(Object.keys(defaultSettingValues));

function sanitizeSetting(key: string, value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return defaultSettingValues[key];

  switch (key) {
    case "offline_timeout":
      return String(Math.min(Math.max(num, 1), 60));
    case "sensor_interval_ms":
      return String(Math.round(Math.min(Math.max(num, 1000), 60000)));
    case "fan_on_temp":
    case "lamp_on_temp":
      return String(Math.min(Math.max(num, 10), 60));
    case "gas_threshold":
      return String(Math.round(Math.min(Math.max(num, 0), 4095)));
    case "actuator_poll_ms":
      return String(Math.round(Math.min(Math.max(num, 500), 10000)));
    default:
      return String(value);
  }
}

export async function GET() {
  try {
    const settings = await db.setting.findMany({
      where: { key: { in: Array.from(allowedSettingKeys) } },
    });
    const settingsMap: Record<string, string> = { ...defaultSettingValues };
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    return NextResponse.json(settingsMap);
  } catch {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entries = Object.entries(body)
      .filter(([key]) => allowedSettingKeys.has(key))
      .map(([key, value]) => [key, sanitizeSetting(key, value)] as const);

    await db.$transaction(
      entries.map(([key, value]) =>
        db.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
