import { useAppTheme } from '@/hooks/ThemeContext';

export function useColors() {
  return useAppTheme().colors;
}
