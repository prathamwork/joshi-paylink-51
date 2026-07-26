import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLinks, updateLinkStatus, duplicateLink } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, isCurrency } from "@/lib/currency";
import { Copy, ExternalLink, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/links/")({
  head: () => ({
    meta: [
      { title: "Payment links — Joshi Web Experts" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LinksPage,
});

function LinksPage() {
  const fn = useServerFn(listLinks);
  const setStatus = useServerFn(updateLinkStatus);
  const dup = useServerFn(duplicateLink);
  const qc = useQueryClient();
  const [status, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["links", status, q],
    queryFn: () => fn({ data: { status, q } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["links"] });

  const cancelM = useMutation({
    mutationFn: (id: string) => setStatus({ data: { id, status: "cancelled" } }),
    onSuccess: () => {
      toast.success("Cancelled");
      invalidate();
    },
  });
  const activateM = useMutation({
    mutationFn: (id: string) => setStatus({ data: { id, status: "active" } }),
    onSuccess: () => {
      toast.success("Activated");
      invalidate();
    },
  });
  const dupM = useMutation({
    mutationFn: (id: string) => dup({ data: { id } }),
    onSuccess: () => {
      toast.success("Duplicated");
      invalidate();
    },
  });

  return (
    <AdminShell title="Payment links">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search client, project, invoice…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Select value={status} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button asChild className="bg-brand-gradient text-primary-foreground shadow-glow">
          <Link to="/links/new">New link</Link>
        </Button>
      </div>

      <Card className="glass overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No links yet. Create your first one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-accent/50 text-left">
              <tr>
                <th className="p-3 font-medium">Client / Project</th>
                <th className="p-3 font-medium">Amount</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Created</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((l) => {
                const url =
                  typeof window !== "undefined"
                    ? `${window.location.origin}/pay/${l.public_code}`
                    : `/pay/${l.public_code}`;
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className="p-3">
                      <div className="font-medium">{l.client_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.project_title}
                        {l.invoice_ref ? ` · ${l.invoice_ref}` : ""}
                      </div>
                    </td>
                    <td className="p-3">
                      {isCurrency(l.currency)
                        ? formatMoney(Number(l.base_amount_minor), l.currency)
                        : `${l.base_amount_minor} ${l.currency}`}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Copy link"
                          onClick={() => {
                            navigator.clipboard.writeText(url);
                            toast.success("Link copied");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Open" asChild>
                          <a href={`/pay/${l.public_code}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/links/$id" params={{ id: l.id }}>
                                View details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => dupM.mutate(l.id)}>
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const msg = `Hi ${l.client_name}, here's your secure payment link for ${l.project_title}: ${url}`;
                                navigator.clipboard.writeText(msg);
                                toast.success("WhatsApp message copied");
                              }}
                            >
                              Copy WhatsApp message
                            </DropdownMenuItem>
                            {l.status === "active" && (
                              <DropdownMenuItem onClick={() => cancelM.mutate(l.id)}>
                                Cancel link
                              </DropdownMenuItem>
                            )}
                            {(l.status === "cancelled" || l.status === "draft") && (
                              <DropdownMenuItem onClick={() => activateM.mutate(l.id)}>
                                Activate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </AdminShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-primary/20 text-primary border-primary/30",
    paid: "bg-success/20 text-success border-success/30",
    draft: "bg-muted text-muted-foreground",
    expired: "bg-warning/20 text-warning border-warning/30",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
}
