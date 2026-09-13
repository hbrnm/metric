import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveTarget } from '../db/operations';

export function useActiveTarget(date: string) {
  return useLiveQuery(() => getActiveTarget(date), [date]);
}
