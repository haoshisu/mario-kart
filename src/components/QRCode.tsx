"use client";

import qrcode from "qrcode-generator";
import { useMemo } from "react";

type QRCodeProps = {
  value: string;
  label: string;
};

export function QRCode({ value, label }: QRCodeProps) {
  const dataUrl = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(value, "Byte");
    code.make();
    return code.createDataURL(5, 3);
  }, [value]);

  return <img alt={label} className="qr-code" height={180} src={dataUrl} width={180} />;
}

