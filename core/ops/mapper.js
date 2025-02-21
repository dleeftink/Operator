function mapper(config) {
  let { name, cache, iterator, transform, debug, init } = config;

  let index = 0;
  let isCaching = true;

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
          cache.push(transform(value));
        } else {
          break; // a break's work is mysterious and important => continue as well
        }
      }

      // Yielding Phase: Return elements from the sorted cache
      if (init && index < cache?.length) {
        return { 
          value: cache[index++], 
          done: false 
        };
      } else if (index < cache?.length) {
        // Modify cache in place
        return {
          value: (cache[index] = transform(cache[index++])),
          done: false
        };
      } else {
        if (debug) cacheLogger(name, init, transform, cache);
        return { value: undefined, done: true };
      }
    }
  };
}
