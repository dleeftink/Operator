function filter(config) {
  let { name, cache, iterator, predicate, debug, init } = config;

  let index = 0;
  let isCaching = true;
  let cacheIterator = cache[Symbol.iterator]();

  return {
    next: () => {
      // Caching Phase: Add elements to Set cache
      while (isCaching) {
        const { value, done } = iterator.next(); // Iterator from the original set
        if (done) {
          isCaching = false;
          break;
        }
        if (cache.has(value)) continue;
        if (init && predicate(value)) {
          cache.add(value);
        } else {
          continue;
        }
      }

      // Yielding Phase
      while (true) {
        const { value, done } = cacheIterator.next();

        if (done) {
          if (debug) cacheLogger(name, init, predicate, cache);
          return { value: undefined, done: true }; // End of iteration
        }

        if (!predicate(value)) {
          cache.delete(value); 
          continue; 
        }

        return { value, done: false };
      }
    }
  };
}
