import type { Metadata } from "next"
import Link from "next/link"
import { Game } from "@/game/Game"

export const metadata: Metadata = {
 title: "多人卡丁車賽事｜Kart Lab",
}

export default async function GamePage({
 searchParams,
}: {
 searchParams: Promise<{ mode?: string | string[] }>
}) {
 const mode = (await searchParams).mode
 const singlePlayer = mode === "solo"
 return (
  <main className="game-page">
   <header className="game-hud">
    <Link className="back-link" href="/">
     <span aria-hidden="true">←</span> 返回
    </Link>
    <div>
     <p>KART LAB · WORLD CIRCUITS</p>
     <h1>{singlePlayer ? "單人練習" : mode === "bots" ? "單人對戰・挑戰電腦" : "卡丁車賽事"}</h1>
    </div>
    <span className="engine-badge">RAPIER ONLINE</span>
   </header>

   <section className="game-stage" aria-label="支援二至四位電腦或手機玩家的 3D 卡丁車多人賽事">
    <Game singlePlayer={singlePlayer} />
   </section>
  </main>
 )
}
