/** Shared shape for GET /api/stores/[storeId]/reports/kpis */
export type ReportsKpisResponse = {
  windowDays: number;
  startsAt: string;
  endsAt: string;
  grossSales: number;
  discounts: number;
  netSales: number;
  taxes: number;
  shipping: number;
  totalSales: number;
  ordersCount: number;
  refundsCount: number;
  aov: number;
};
