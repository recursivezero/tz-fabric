export const ANALYSIS_RESPONSE_COUNT = 6;

/** Map the UI's zero-based response slot to the API's one-based variation id. */
export const toBackendResponseIndex = (uiIndex: number): number => uiIndex + 1;
