import { useState } from "react";

import { Button } from "@/components/ui/button";

export default function ButtonDemo() {
  const [count, setCount] = useState(0);

  return (
    <div className="mt-6 flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div>
        <p className="text-sm text-muted-foreground">shadcn/ui Button example</p>
        <p className="text-lg font-semibold">Count: {count}</p>
      </div>
      <Button onClick={() => setCount((value) => value + 1)}>Click me</Button>
      <Button variant="secondary" onClick={() => setCount(0)}>
        Reset
      </Button>
    </div>
  );
}
