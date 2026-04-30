import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 14, fontSize: 5, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingBottom: 4, marginBottom: 2 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 2 },
  cell: { flexGrow: 1, flexBasis: 0, paddingHorizontal: 2 },
});

const ROWS_PER_PAGE = 28;

type Props = { headers: string[]; rows: string[][] };

export function ProductExportPdfDocument({ headers, rows }: Props) {
  const chunks: string[][][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    chunks.push(rows.slice(i, i + ROWS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  return (
    <Document>
      {chunks.map((chunk, pi) => (
        <Page key={pi} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.headerRow}>
            {headers.map((h, i) => (
              <View key={i} style={styles.cell}>
                <Text wrap>{h}</Text>
              </View>
            ))}
          </View>
          {chunk.map((row, ri) => (
            <View key={ri} style={styles.row} wrap={false}>
              {row.map((cell, ci) => (
                <View key={ci} style={styles.cell}>
                  <Text wrap>{String(cell).slice(0, 800)}</Text>
                </View>
              ))}
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}
