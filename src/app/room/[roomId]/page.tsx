import Link from "next/link";

type RoomPageProps = {
  params: Promise<{ roomId: string }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;

  return (
    <main className="placeholder-page">
      <p className="eyebrow">FUTURE MODULE</p>
      <h1>房間 {roomId}</h1>
      <p>多人遊戲大廳的路由已預留，本階段尚未實作連線功能。</p>
      <Link className="text-link" href="/">
        返回首頁
      </Link>
    </main>
  );
}
