import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  DEFAULT_LOCAL_REPORT_NAME_LABELS,
  getLocalReportNameLabels,
  getLocalReportNameLabelsError,
  LOCAL_REPORT_NAME_LABELS_KEY,
  saveLocalReportNameLabels,
  type LocalReportNameLabels,
} from '@/lib/local-report-labels';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not access local report labels.';
}

export function useLocalReportNameLabels() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<LocalReportNameLabels | null>(null);
  const labelsQuery = useQuery({
    queryKey: LOCAL_REPORT_NAME_LABELS_KEY,
    queryFn: getLocalReportNameLabels,
  });
  const saveMutation = useMutation({
    mutationFn: saveLocalReportNameLabels,
    onSuccess: (labels) => {
      queryClient.setQueryData(LOCAL_REPORT_NAME_LABELS_KEY, labels);
      setDraft(null);
    },
  });

  const savedLabels = labelsQuery.data ?? DEFAULT_LOCAL_REPORT_NAME_LABELS;
  const labels = draft ?? savedLabels;
  const validationError = getLocalReportNameLabelsError(labels);
  const isDirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(savedLabels);
  const error = labelsQuery.error ?? saveMutation.error;

  return {
    labels,
    isReady: labelsQuery.isSuccess,
    isLoading: labelsQuery.isLoading,
    isValid: validationError === null,
    isDirty,
    isSaving: saveMutation.isPending,
    errorMessage: error ? errorMessage(error) : '',
    validationError,
    onChange: (nextLabels: LocalReportNameLabels) => {
      setDraft(nextLabels);
      saveMutation.reset();
    },
    save: () => {
      if (draft && !getLocalReportNameLabelsError(draft)) {
        saveMutation.mutate(draft);
      }
    },
  };
}
