import { useEffect, useMemo, useState } from 'react';
import { getHiveId } from '../utils/analyticsFormat';

export function useSelectedHive(hives) {
  const [selectedHiveId, setSelectedHiveId] = useState('');

  // Keep the selected hive valid
  useEffect(() => {
    if (!hives.length) {
      setSelectedHiveId('');
      return;
    }

    const selectedExists = hives.some(hive => String(getHiveId(hive)) === String(selectedHiveId));
    if (selectedExists) return;

    const fallbackHive = hives.find(hive => getHiveId(hive));
    setSelectedHiveId(fallbackHive ? String(getHiveId(fallbackHive)) : '');
  }, [hives, selectedHiveId]);

  // Expose the active hive
  const selectedHive = useMemo(
    () => hives.find(hive => String(getHiveId(hive)) === String(selectedHiveId)) ?? null,
    [hives, selectedHiveId],
  );

  return {
    selectedHive,
    selectedHiveId,
    setSelectedHiveId: value => setSelectedHiveId(value ? String(value) : ''),
  };
}
