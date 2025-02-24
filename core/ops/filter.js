function filter(config) {
  
  let { name, cache, iterator, predicate, debug, init } = config;
  let { enabled } = cache, nth = 0, row = -1;
  
  if (debug) console.log(name,"uses cache",enabled);
  
  return {
    next: () => {
      while (true) {

        let { value, done } = iterator.next();
        if (done) {
          
          if (debug) cacheLogger(name, init, predicate, cache);
          if (cache.primed && enabled) {
            iterator = cache[Symbol.iterator]();
            cache.primed = false;
          }
          if (enabled) cache.primed = true;
          return { value: undefined, done: true };
          
        } row++
        
        if (init && cache.has(value)) continue;
        if (predicate(value,row,nth++)) {
          /*if(enabled)*/ cache.add(value); // => Filter cache always on or not? => add dedupe option
          return { value, done };
        } else if(enabled) {
          cache.delete(value) // Evict non-matches
        }
      }
    }
  };
}
