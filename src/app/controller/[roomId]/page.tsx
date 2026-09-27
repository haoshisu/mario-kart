import type { Metadata } from "next";
import { MobileController } from "@/game/network/MobileController";

export const metadata: Metadata = {
  title: "手機控制器｜Kart Lab",
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
