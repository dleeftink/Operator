function mapper(config) {
  
  let { name, cache, iterator, transform, debug, init } = config;
  let { enabled } = cache, row = -1;
  
  if (debug) console.log(name,"uses cache",enabled);

  return {
    next: () => {

      let { value, done } = iterator.next();

      if (done) { 
        if (debug) cacheLogger(name, init, transform, cache);
        if (cache.primed && enabled) {
          iterator = cache[Symbol.iterator]();
          cache.primed = false;
        }
        if(enabled) cache.primed = true
        return {value, done}
      } row++; 
        value = transform(value,row);
      
      if (init && enabled) { 
        cache.push(value) 
      } else if(enabled && !done) {
        cache[row] = value // circular buffer style
      }

      return { value, done };
    }
  };
}
