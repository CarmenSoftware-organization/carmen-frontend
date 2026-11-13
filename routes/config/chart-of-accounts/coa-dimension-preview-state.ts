export interface DimensionPreview {
  allowedValueIds: string[];
  defaultValueId: string | null;
}

export const EMPTY_DIMENSION_PREVIEW: DimensionPreview = {
  allowedValueIds: [],
  defaultValueId: null,
};

export function updateAllowedValues(
  current: DimensionPreview,
  allowedValueIds: string[],
): DimensionPreview {
  return {
    allowedValueIds,
    defaultValueId:
      current.defaultValueId && allowedValueIds.includes(current.defaultValueId)
        ? current.defaultValueId
        : null,
  };
}
