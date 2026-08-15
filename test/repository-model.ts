import type {
  ModelReviewRequest,
  ModelReviewResult,
  ReviewModel,
} from "@adversarylabs/sdk";

export function repositoryReviewModel(
  paths: readonly string[],
  finalReview: <T>(request: ModelReviewRequest) => Promise<ModelReviewResult<T>>,
): ReviewModel {
  let retrievalIndex = 0;
  return {
    async review<T>(request: ModelReviewRequest): Promise<ModelReviewResult<T>> {
      const properties = request.schema.properties as Record<string, unknown> | undefined;
      if (properties?.ready !== undefined) {
        if (retrievalIndex < paths.length) {
          const batch = paths.slice(retrievalIndex, retrievalIndex + 8);
          retrievalIndex += batch.length;
          return {
            output: {
              ready: false,
              operations: batch.map((path) => ({
                tool: "read_file",
                path,
                cursor: 0,
                startLine: 1,
                endLine: 320,
              })),
            } as T,
            provider: "fixture",
            model: "retrieval-planner",
          };
        }
        return {
          output: { ready: true, operations: [] } as T,
          provider: "fixture",
          model: "retrieval-planner",
        };
      }
      retrievalIndex = 0;
      return finalReview<T>(request);
    },
  };
}
