/**
 * Reserved for a future RAG / external docs integration (separate KM project).
 * The in-app assistant does not query external URLs yet.
 */
export async function searchExternalDocsPlaceholder(_query: string): Promise<{ message: string }> {
  return {
    message: "External documentation search is not configured in this deployment.",
  };
}
