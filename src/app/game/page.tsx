import type { Metadata } from "next"
import Link from "next/link"
import { Game } from "@/game/Game"

export const metadata: Metadata = {
 title: "手機控制計時賽｜Kart Lab",
}

export default function GamePage() {
 return (
  <main className="game-page">
   <header className="game-hud">
    <Link className="back-link" href="/">
     <span aria-hidden="true">←</span> 返回
    </Link>
    <div>
     <p>PHASE 3 · PHONE CONTROLLER</p>
     <h1>手機控制計時賽</h1>
    </div>
    <span className="engine-badge">RAPIER ONLINE</span>
   </header>

   <section className="game-stage" aria-label="可使用手機控制器的 3D 卡丁車單人計時賽">
    <Game />
   </section>
  </main>
 )
}
