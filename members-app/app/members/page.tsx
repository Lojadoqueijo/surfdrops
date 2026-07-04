import { getSnapshots } from "@/lib/data/getSnapshots";
import { toTerminalRows } from "@/lib/data/terminal";
import Terminal from "./Terminal";

export const revalidate = 3600; // 1h de cache; o cron diário força refresh

export default async function MembersPage() {
  const snapshots = await getSnapshots();
  const rows = toTerminalRows(snapshots);
  const updatedAt = snapshots[0]?.updatedAt ?? new Date().toISOString();
  const mock = process.env.USE_MOCK === "1" || !process.env.TWELVEDATA_API_KEY;

  return <Terminal rows={rows} updatedAt={updatedAt} mock={mock} />;
}
