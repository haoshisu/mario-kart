export function DrivingGuide() {
  return <div className="driving-guide" aria-label="按鍵說明">
    <span><kbd>↑</kbd> 加速</span><span><kbd>↓</kbd> 煞車／倒車</span>
    <span><kbd>←</kbd><kbd>→</kbd> 轉向</span>
    <span><kbd>Space</kbd> 按住漂移</span><span><kbd>E</kbd> 使用前格道具</span>
    <small>也可用 WASD；先按住方向＋加速，再按 Space 漂移，放開釋放加速。</small>
  </div>;
}
