import Link from "next/link";

const foundations = [
  ["四人 Lobby", "掃碼加入、選色、Ready 與 Host 開賽"],
  ["原創道具", "脈衝推進、光環護盾與旋流陷阱"],
  ["權威競速", "60 Hz 物理、三圈排名、音效回饋與同房重賽"],
];

export default function HomePage() {
  return (
    <main className="home-shell">
      <div className="ambient-orb ambient-orb--left" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--right" aria-hidden="true" />

      <section className="hero">
        <p className="eyebrow">ORIGINAL ARCADE · WINDMILL VALLEY</p>
        <h1>
          Kart <span>Lab</span>
        </h1>
        <p className="hero__copy">
          建立房間並分享連結，二至四位玩家各自在電腦或手機上觀看自己的跟車畫面，拾取道具、攻防競速。
        </p>

        <div className="hero__actions">
          <Link className="primary-button" href="/game">
            建立多人卡丁車賽事
            <span aria-hidden="true">→</span>
          </Link>
          <Link className="primary-button" href="/game?mode=bots">單人挑戰電腦</Link>
          <span className="status-pill">
            <i aria-hidden="true" /> Colyseus 權威同步
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
        <span>Phase 6 開發版 · 原創車款與場景 · 免費主機可能需等待啟動</span>
      </footer>
      <details className="play-guide">
        <summary>遊玩方式、連線限制與隱私</summary>
        <p>房主直接參賽，朋友開啟連結或掃碼，選暱稱與車色並準備後，由房主開賽。每人都有獨立畫面；電腦可切換鍵盤，手機可同時觀看賽道與觸控操作，建議橫向遊玩。傾斜操作需同意感測器權限。</p>
        <p>單人挑戰電腦可用鍵盤或手機。鍵盤使用 WASD／方向鍵、Space 漂移、E 使用道具；音效需先點擊啟用。若畫面不順，可切換省電畫質。</p>
        <p>朋友試玩主機可能休眠，建房請預留約一分鐘。伺服器重啟會清空房間，需要重新建房；請勿在暱稱輸入個人敏感資料。</p>
        <p>本遊戲不建立帳號或持久化排行榜。暱稱與比賽狀態用於目前房間，瀏覽器 sessionStorage 保存重連資訊；主機供應商可能保留必要連線紀錄。遊戲伺服器紀錄不包含暱稱、輸入內容或重連 token。</p>
      </details>
    </main>
  );
}
