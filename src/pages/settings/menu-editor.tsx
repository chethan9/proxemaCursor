import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { SettingsLayout } from "@/components/layout/SettingsLayout";

export default function MenuEditorPage() {
  return (
    <SettingsLayout title="Menu editor">
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Menu editor is being rebuilt. Check back soon.
      </div>
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});