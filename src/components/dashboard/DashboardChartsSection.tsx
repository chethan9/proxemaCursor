"use client";

import { useTranslation } from "next-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";

type SyncStatusDatum = {
  name: string;
  value: number;
  color: string;
};

type AspectChartDatum = {
  aspect: string;
  successful: number;
  failed: number;
};

type TimelineDatum = {
  date: string;
  successful: number;
  failed: number;
};

type DashboardChartsSectionProps = {
  syncStatusData: SyncStatusDatum[];
  successRate: number;
  aspectChartData: AspectChartDatum[];
  timelineData: TimelineDatum[];
};

export function DashboardChartsSection({
  syncStatusData,
  successRate,
  aspectChartData,
  timelineData,
}: DashboardChartsSectionProps) {
  const { t } = useTranslation("common");
  const barSuccessful = t("platformDashboard.charts.barSuccessful");
  const barFailed = t("platformDashboard.charts.barFailed");

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("platformDashboard.charts.syncStatusTitle")}</CardTitle>
            <CardDescription>{t("platformDashboard.charts.syncStatusDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {syncStatusData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                <p className="text-sm">{t("platformDashboard.charts.noSyncData")}</p>
              </div>
            ) : (
              <>
                <div className="h-[220px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={syncStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {syncStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold tabular-nums">{successRate}%</span>
                    <span className="text-xs text-muted-foreground">{t("platformDashboard.charts.successRateLabel")}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  {syncStatusData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <span className="font-medium tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{t("platformDashboard.charts.syncsByTypeTitle")}</CardTitle>
            <CardDescription>{t("platformDashboard.charts.syncsByTypeDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {aspectChartData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                <p className="text-sm">{t("platformDashboard.charts.noSyncData")}</p>
              </div>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aspectChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={4} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="aspect"
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="circle" />
                    <Bar dataKey="successful" name={barSuccessful} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="failed" name={barFailed} fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("platformDashboard.charts.timelineTitle")}</CardTitle>
          <CardDescription>{t("platformDashboard.charts.timelineDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {timelineData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground">
              <p className="text-sm">{t("platformDashboard.charts.noSyncActivity")}</p>
            </div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="circle" />
                  <Line type="monotone" dataKey="successful" name={barSuccessful} stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} />
                  <Line type="monotone" dataKey="failed" name={barFailed} stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
