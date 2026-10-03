"use client";

import { Component, type ReactNode } from "react";
import { useProgress } from "@react-three/drei";

export function SceneLoading() {
  const { active, progress } = useProgress();
  return active ? <div className="scene-notice scene-loading" role="status">載入 3D 資產… {Math.round(progress)}%</div> : null;
}

export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="scene-notice" role="alert">
      <p>3D 資產或 WebGL 載入失敗，請確認網路並重新載入。</p>
      <button type="button" onClick={() => window.location.reload()}>重新載入</button>
    </div>;
    return this.props.children;
  }
}
