import { getSnapshots } from "@/lib/data/getSnapshots";
import { readLatestSnapshots } from "@/lib/data/supabase";
import { toTerminalRows } from "@/lib/data/terminal";
import Terminal from "./Terminal";

export const revalidate = 3600; // 1h de cache; o cron diário força refresh

export default async function MembersPage() {
  // Fonte preferida: snapshots persistidos pelo cron (Supabase) — instantâneo
  // e sem gastar créditos do Twelve Data por visita. Fallback (BD ainda não
  // configurada/preenchida): computa ao vivo, sem throttle — alguns ativos TD
  // podem falhar nesse pedido (429), mas a página carrega.
  const db = await readLatestSnapshots();
  const snapshots = db?.rows?.length ? db.rows : await getSnapshots(undefined, { throttle: false });
  const rows = toTerminalRows(snapshots);
  const updatedAt = db?.updatedAt || snapshots[0]?.updatedAt || new Date().toISOString();
  const mock = !db?.rows?.length && (process.env.USE_MOCK === "1" || !process.env.TWELVEDATA_API_KEY);

  return <Terminal rows={rows} updatedAt={updatedAt} mock={mock} />;
}
