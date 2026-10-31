import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLocalReportHideNamesPreference,
  LOCAL_REPORT_NAME_VISIBILITY_KEY,
  saveLocalReportHideNamesPreference,
} from '@/lib/local-report-labels';

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Could not access the local report privacy preference.';
}

export function useLocalReportNameVisibility() {
  const queryClient = useQueryClient();
  const visibilityQuery = useQuery({
    queryKey: LOCAL_REPORT_NAME_VISIBILITY_KEY,
    queryFn: getLocalReportHideNamesPreference,
  });
  const saveMutation = useMutation({
    mutationFn: saveLocalReportHideNamesPreference,
    onMutate: async (hidePlayerNames) => {
      await queryClient.cancelQueries({
        queryKey: LOCAL_REPORT_NAME_VISIBILITY_KEY,
      });
      const previousValue = queryClient.getQueryData<boolean>(
        LOCAL_REPORT_NAME_VISIBILITY_KEY,
      );
      queryClient.setQueryData(
        LOCAL_REPORT_NAME_VISIBILITY_KEY,
        hidePlayerNames,
      );
      return { previousValue };
    },
    onError: (_error, _hidePlayerNames, context) => {
      if (context?.previousValue !== undefined) {
        queryClient.setQueryData(
          LOCAL_REPORT_NAME_VISIBILITY_KEY,
          context.previousValue,
        );
      }
    },
    onSuccess: (hidePlayerNames) => {
      queryClient.setQueryData(
        LOCAL_REPORT_NAME_VISIBILITY_KEY,
        hidePlayerNames,
      );
    },
  });
  const error = visibilityQuery.error ?? saveMutation.error;

  return {
    hidePlayerNames: visibilityQuery.data ?? false,
    isReady: visibilityQuery.isSuccess,
    isSaving: saveMutation.isPending,
    errorMessage: error ? errorMessage(error) : '',
    toggle: () => {
      if (!visibilityQuery.isSuccess || saveMutation.isPending) return;
      saveMutation.mutate(!(visibilityQuery.data ?? false));
    },
  };
}
