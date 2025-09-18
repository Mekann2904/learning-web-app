import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

type CopyCodeButtonProps = {
  code: string;
  label?: string;
};

const COPY_RESET_DELAY = 2000;

export default function CopyCodeButton({ code, label = "コードをコピー" }: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className="inline-flex items-center gap-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), COPY_RESET_DELAY);
        } catch (error) {
          console.error("Failed to copy code", error);
          setCopied(false);
        }
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "コピーしました" : label}
    </Button>
  );
}
