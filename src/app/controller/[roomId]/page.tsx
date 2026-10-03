import type { Metadata } from "next";
import { MobileController } from "@/game/network/MobileController";

export const metadata: Metadata = {
  title: "加入賽事｜Kart Lab",
};

type ControllerPageProps = {
  params: Promise<{ roomId: string }>;
};

export default async function ControllerPage({ params }: ControllerPageProps) {
  const { roomId } = await params;

  return (
    <MobileController roomId={roomId} />
  );
}
