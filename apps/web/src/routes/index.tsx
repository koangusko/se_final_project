import { createFileRoute, Link } from "@tanstack/react-router";
import { useMe } from "../lib/auth.ts";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const CARDS = [
  {
    to: "/space",
    title: "空間查詢",
    body: "瀏覽管院各樓層教室、設備與 360 度環景，不需要登入。",
  },
  {
    to: "/booking",
    title: "預約借用",
    body: "查看教室每週狀態，預約教室並借用鑰匙、投影筆、筆電。",
  },
  {
    to: "/scheduling",
    title: "課程排課",
    body: "教師登錄課程時段，全院課程以週曆呈現。",
  },
] as const;

function HomePage() {
  const me = useMe();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          暨大管理學院 空間與課程
        </h1>
        <p className="mt-2 text-ink-muted">
          {me ? `${me.name ?? me.displayName}，你好。` : "登入後可以預約教室與借用設備。"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-card border border-line bg-surface p-5 transition-colors hover:border-accent"
          >
            <h2 className="font-semibold">{c.title}</h2>
            <p className="mt-2 text-sm text-ink-muted">{c.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
