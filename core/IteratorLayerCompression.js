// Compressed iterator layers stress test

  let setSeqB = new Set(shuffleArray(Array.from({length:1000000},(_,i)=>i)))

  let testMax = 1000000
  
  class Base {
    #debug = false;
    constructor(input) {
      // Accumulate results if provided
      if (input === Array) {
        return Array.from(this);
      } else if (input === Set) {
        if(this.constructor.Set) return new Set(this.constructor.Set) // cache not even used this way
        const result = new input
        if (this.#debug) console.log("Building set");

        let i = 0;
        const bufferSize = 2048 + 1024;
        const buffer = Array(bufferSize);

        for (const item of this) {
          buffer[i++] = item;

          if (i === bufferSize) {
            for (let j = 0; j < i; j++) {
              result.add(buffer[j]);
            }
            i = 0;
          }
        }

        for (let j = 0; j < i; j++) {
          result.add(buffer[j]);
        }
        return this.constructor.Set = result;
      } else if (input) this.data = input;
    }

    // Base class iterator logic
    [Symbol.iterator]() {
      let source = (this.data ?? this.constructor.data)[Symbol.iterator]();
      return source;
    }

    extend(def) {
      return this.constructor.extend.call(this, def);
    }

    static extend(next = {}) {
      let { name = "Layer", methods, statics, evaluate, transform, predicate, cache: Cache = Array } = next;

      // Setup reference chain 
      let prev = this instanceof Function ? this : this.constructor;
      let data = this.data ?? this.constructor.data;
      let root = Object.getPrototypeOf(prev).prototype ? prev.root : this;

      // Check if new Layer
      let newLayer = prev.name !== name;
      let cache = newLayer ? new Cache() : prev.cache; // seems fastest without caching...
       cache = undefined
      // Accumulate transformations and predicates
      let transforms = prev.transforms ? [...prev.transforms] : [];
      let predicates = newLayer ? [] : [...prev.predicates]; // Reset predicates for new layers

      if (transform) transforms.push(transform);
      if (predicate) predicates.push(predicate);

      // Compose the exec function
      let composed;

      if (newLayer) {
        composed = (config) => {
          // Create a new iterator by applying the previous exec
          let innerIterator = prev.evaluate
            ? prev.evaluate({ ...config, cache: prev.cache }) // Pass previous layer's cache
            : config.iterator;

          // Pass the composed iterator to the current evaluate function
          return next.evaluate({ ...config, iterator: innerIterator, cache, predicates });
        };
      }

      // Name is automatically stored with class
      let Layer = newLayer
        ? {
            [name]: class extends prev {
              static root = root;
              static data = data;
              static prev = prev;
              static cache = cache;
              static transforms = transforms; // Accumulated transformations
              static predicates = predicates; // Scoped predicates for this layer

              static evaluate = composed;

              [Symbol.iterator]() {
                // Else return cache in case of branching
                if (cache?.length > 0 || cache?.size > 0) {
                  // console.log("Cache hit at", name);
                  return cache.values();
                }

                // Run main iterator
                return this.constructor.evaluate({
                  iterator: this.constructor.data[Symbol.iterator](), // No more super
                  transforms: this.constructor.transforms,
                  predicates: this.constructor.predicates,
                  cache
                });
              }
            },
          }[name]
        : Object.assign(prev, { transforms, predicates }); // Accumulate transforms

      if (methods) Object.assign(Layer.prototype, methods);
      if (statics) Object.assign(Layer, statics);

      return Layer;
    }
  }

  function transducer(config) {
    const { iterator, transforms, predicates, cache } = config;
    return {
      next: () => {
        while (true) {
          let { value, done } = iterator.next();
          if (done) {
            return { value: undefined, done: true }; // End of iteration
          }

          for (let transform of transforms) {
            value = transform(value);
          }

          let passes = predicates.every((predicate) => predicate(value));
          if (passes) {
            if (cache) cache.push(value);
            return { value, done };
          }
        }
      },
    };
  }

  function filterSet(config) {
    const { cache, iterator, predicates } = config;
    return {
      next: () => {
        while (true) {
          let { value, done } = iterator.next();
          if (done) {
            return { value: undefined, done: true }; // End of iteration
          }

          if (cache && !cache.has(value) && predicates.every((predicate) => predicate(value))) {
            cache.add(value);
            return { value, done }; 
        
          } else if (predicates.every((predicate) => predicate(value))) {
            return { value, done };
          }
        }
      },
    };
  }

  function* mapGen(config) {
    const { cache, iterator, transforms } = config;
    for (let item of iterator) {
      for (let transform of transforms) {
         item = transform(item);
       }
      if (cache) cache.push(item);
      yield item
    }
  }

  function* filterGen(config) {
    const { cache, iterator, predicates } = config;
    for (const item of iterator) {
      if (cache) {
        if (!cache.has(item) && predicates.every((predicate) => predicate(item))) {
          cache.add(item); // Add the value to the seen Set
          yield item // Pass the value through
        }
      } else if (predicates.every((predicate) => predicate(item))) { // Else iterating over layer cache
        yield item
      }
    }
  }

  let t1 = performance.now();
  let main = new Base(setSeqB)
    .extend({
      name: "Filter",
      cache: Set,
      predicate: (v) => v < testMax,
      evaluate: filterSet,
    })
    .extend({
      name: "Mapper",
      transform: (v) => v * 2,
      evaluate: transducer,
    })
    .extend({
      name: "Mapper",
      transform: (v) => v * 2,
    })
    .extend({
      name: "Mapper",
      transform: (v) => v * 2,
    })
    .extend({
      name: "Filter",
      cache: Set,
      predicate: (v) => v > 0 ,
      evaluate: filterSet,
    })
    .extend({
      name: "Filter",
      predicate: (v) => v < 8000000,
    });

  let out = new main(Set);
  let out2 = new main(Set);
  //let out3 = new main(Set);

  let t2 = performance.now()
  let arr = new Set(Array.from(setSeqB).filter(d=>d<testMax).map(d=> d * 2).map(d=> d * 2).map(d=> d * 2).filter(d=>d>0) .filter(d=>d<80000000))
  // ((d * 2)*2)*2
  let arr2 = new Set(Array.from(setSeqB).filter(d=>d<testMax).map(d=> d * 2).map(d=> d * 2).map(d=> d * 2).filter(d=>d>0) .filter(d=>d<80000000))
  // let arr3 = new Set(Array.from(setSeqB).filter(d=>d<testMax).map(d=> d * 2).map(d=> d * 2).map(d=> d * 2).filter(d=>d>0) .filter(d=>d<80000000))
  let t3 = performance.now()

  let out = {
    lazy: ~~(t2 - t1),  native: ~~(t3 - t2),
    out,
    out2,
    //out3,
    arr,arr2,//arr3
  };

  console.log(out)

  function shuffleArray(array) {
    for (let i = array.length - 1; i >= 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array
  }
