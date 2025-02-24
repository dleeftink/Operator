function sorter(config) {
  
  let { name, cache, iterator, comparator, debug, init } = config;
  let { enabled } = { enabled: true }; // Always on;

  if (debug) console.log(name, "uses cache", enabled);

  if (!cache.sorted) {
    while (true) {
      const { value, done } = iterator.next();
      if (done) {
        iterator = cache[Symbol.iterator]();
        cache.sort(comparator);
        cache.sorted = true;
        break;
      }
      cache.push(value);
    }
  } else {
    incrementalSort(cache,comparator)
  }

  return {
    next: () => {
      let { value, done } = iterator.next();

      if (done) {
        if (debug) cacheLogger(name, init, comparator, cache);
        return { value, done };
      }

      return { value, done };
    }
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
