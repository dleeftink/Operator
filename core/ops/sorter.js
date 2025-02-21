function sorter(config) {
  let { name, cache, iterator, comparator, debug, init } = config;

  let index = 0;
  let isCaching = true;
  let isSorted = false; // Track whether the cache is sorted

  return {
    next: () => {
      // Caching Phase: Add elements to Array cache
      while (isCaching) {
        const { value, done } = iterator.next();
        if (done) {
          isCaching = false;
          break;
        }
        if (init) {
          cache.push(value);
        } else {
          break; // Exit caching phase early if not initializing
        }
      }

      // Initial Full Sort
      if (!isSorted && cache.length > 0) {
        cache.sort(comparator);
        isSorted = true; // Mark as sorted after the first full sort
      }

      // Incremental Sort (for subsequent calls with a new comparator)
      if (index === 0 && !init && isSorted) {
        incrementalSort(cache, comparator);
      }

      // Yielding Phase: Return elements from the sorted cache
      if (index < cache.length) {
        return { value: cache[index++], done: false };
      } else {
        if (debug) cacheLogger(name, init, comparator, cache);
        return { value: undefined, done: true };
      }
    },
  };
}

function incrementalSort(array, comparator) {
  let changed = true;

  while (changed) {
    changed = false;

    for (let i = 0; i < array.length - 1; i++) {
      const a = array[i];
      const b = array[i + 1];

      if (comparator(a, b) > 0) {
        [array[i], array[i + 1]] = [array[i + 1], array[i]];
        changed = true;
      }
    }
  }
}
