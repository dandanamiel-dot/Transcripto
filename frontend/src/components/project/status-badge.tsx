import { Badge } from "@/components/ui/badge";
import { HE, STATUS_COLORS } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const label = HE.status[status as keyof typeof HE.status] ?? status;
  const color = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";

  return (
    <Badge variant="secondary" className={color}>
      {label}
    </Badge>
  );
}
