export function DrivingGuide() {
  return <div className="driving-guide" aria-label="按鍵說明">
    <span><kbd>↑</kbd> 加速</span><span><kbd>↓</kbd> 煞車／倒車</span>
    <span><kbd>←</kbd><kbd>→</kbd> 轉向</span>
    <span><kbd>Space</kbd> 按住漂移</span><span><kbd>E</kbd> 使用前格道具</span>
    <small>也可用 WASD；方向＋Space 漂移，反打拉大弧線，放開加速。跟車蓄滿尾流後拉出超車可加速。台北起跳時點按 Space 做特技。</small>
  </div>;
}
