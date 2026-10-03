import Link from "next/link";

type RoomPageProps = {
  params: Promise<{ roomId: string }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;

  return (
    <main className="placeholder-page">
      <p className="eyebrow">PHASE 5 · ITEM RACE</p>
      <h1>房間 {roomId}</h1>
      <p>在電腦或手機加入房間，觀看自己的跟車畫面並直接操作。</p>
      <Link className="text-link" href={`/controller/${encodeURIComponent(roomId)}`}>
        加入這個房間
      </Link>
    </main>
  );
}
