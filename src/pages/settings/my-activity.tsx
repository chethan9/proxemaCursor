import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Activity } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import { listMyActivity, type ActivityLogEntry } from "@/services/activityLogService";
import { ActivityFeedRow } from "@/components/ActivityFeedRow";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { formatNumber } from "@/lib/format-number";

export default function MyActivityPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation("settings");
  const [rows, setRows] = useState<ActivityLogEntry[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    listMyActivity(user.id, page, 50)
      .then((res) => {
        if (cancelled) return;
        setRows((prev) => (page === 0 ? res.rows : [...prev, ...res.rows]));
        setCount(res.count);
      })
      .catch((e) => console.error("[my-activity]", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, page]);

  return (
    <SettingsLayout title={t("myActivity.title")}>
      <div className="p-6 space-y-5 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {t("myActivity.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("myActivity.subtitle")}
            {count !== null && <span className="ml-2">{formatNumber(count, i18n.language)}</span>}
          </p>
        </div>

        <div className="space-y-2">
          {loading && rows.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && rows.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                {t("myActivity.empty")}
              </CardContent>
            </Card>
          )}
          {rows.map((entry) => (
            <ActivityFeedRow key={entry.id} entry={entry} />
          ))}
        </div>

        {rows.length > 0 && count !== null && rows.length < count && (
          <div className="flex justify-center py-4">
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("myActivity.loadMore")}
            </Button>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});