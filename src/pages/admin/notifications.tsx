import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ComposeForm } from "@/components/notifications-admin/ComposeForm";
import { HistoryTable } from "@/components/notifications-admin/HistoryTable";
import { ActivityLog } from "@/components/notifications-admin/ActivityLog";
import { Bell, ShieldAlert } from "lucide-react";
import type { ComposePayload } from "@/services/notificationAdminService";

export default function NotificationsAdminPage() {
  const { isSuperAdmin, loading } = useAuth();
  const [tab, setTab] = useState("compose");
  const [prefill, setPrefill] = useState<Partial<ComposePayload> | undefined>();

  if (loading) return <AppLayout><div className="p-8 text-sm text-muted-foreground">Loading…</div></AppLayout>;

  if (!isSuperAdmin) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto mt-24">
          <Card className="p-8 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">Access denied</h2>
            <p className="text-sm text-muted-foreground">This console is restricted to super admins.</p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const handleDuplicate = (pf: Partial<ComposePayload>) => { setPrefill(pf); setTab("compose"); };

  return (
    <AuthGuard>
      <AppLayout>
        <div className="px-6 py-6 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Notifications console</h1>
              <p className="text-sm text-muted-foreground">Compose, send, and monitor notifications across the platform</p>
            </div>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="compose">Compose</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="activity">Activity log</TabsTrigger>
            </TabsList>
            <TabsContent value="compose" className="mt-5">
              <ComposeForm prefill={prefill} onSent={() => setPrefill(undefined)} />
            </TabsContent>
            <TabsContent value="history" className="mt-5">
              <HistoryTable onDuplicate={handleDuplicate} />
            </TabsContent>
            <TabsContent value="activity" className="mt-5">
              <ActivityLog />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </AuthGuard>
  );
}