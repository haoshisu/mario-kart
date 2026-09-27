import Link from "next/link";

const foundations = [
  ["掃碼配對", "Host 建房、QR Code 與不可預測的房間代碼"],
  ["手機操控", "多點觸控油門、煞車、轉向與漂移"],
  ["安全斷線", "輸入限流、逾時歸零、狀態提示與短暫重連"],
];

export default function HomePage() {
  return (
    <main className="home-shell">
      <div className="ambient-orb ambient-orb--left" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--right" aria-hidden="true" />

      <section className="hero">
        <p className="eyebrow">WEB 3D · PHASE 3</p>
        <h1>
          Kart <span>Lab</span>
        </h1>
        <p className="hero__copy">
          在桌面建立房間，用手機掃描 QR Code，透過即時觸控或傾斜操作完整三圈計時賽。
        </p>

        <div className="hero__actions">
          <Link className="primary-button" href="/game">
            建立手機控制賽事
            <span aria-hidden="true">→</span>
          </Link>
          <span className="status-pill">
            <i aria-hidden="true" /> Colyseus 即時輸入
          </span>
        </div>
      </section>

      <section className="foundation-grid" aria-label="目前完成的基礎能力">
        {foundations.map(([title, description], index) => (
          <article className="foundation-card" key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <footer className="home-footer">
        <span>Next.js · TypeScript · R3F · Rapier</span>
        <span>本階段為單一手機控制單一 Host 車輛；多人同步留待 Phase 4</span>
      </footer>
    </main>
  );
}
