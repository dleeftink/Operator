// Layered iterator stress test

  let setSeqA = new Set(shuffleArray(Array.from({length:1000000},(_,i)=>i)))

  let testMax = 1000

  class Base {

    #debug = false;
    constructor(input) {

      if(input === Base) {
        // Aim is to create a new branch that benefits from cached results
        return new (class Branch extends Base {})(this)
      } else if (input === Array) {
        return Array.from(this);
      } else if (input === Set) {
        if(this.constructor.Set) return new Set(this.constructor.Set) // cache is not even used this way
        const result = new input();
        if (this.#debug) console.log("Building set");

        let i = 0; // Current position in the buffer
        const bufferSize = 2048 + 1024; // Buffer size
        const buffer = Array(bufferSize); // Preallocate buffer

        for (const item of this) {
          buffer[i++] = item; // Add item to buffer

          // Flush buffer when full
          if (i === bufferSize) {
            for (let j = 0; j < i; j++) {
              result.add(buffer[j]); // Add items in original order
            }
            i = 0; // Reset buffer position
          }
        }

        // Flush any remaining items in the buffer
        for (let j = 0; j < i; j++) {
          result.add(buffer[j]);
        }
        return this.constructor.Set = result; //  return new Set(this); // accumulate results
        
      // Is this the safest way to check for instancing ...
      } else if(input instanceof Base) {
        this.constructor.data = input // => Hides branch from view
      } else if (input) { 
        this.data = input;
      }
    }

    // Base class iterator logic
    [Symbol.iterator]() {
      let source = (this.data ?? this.constructor.data)[Symbol.iterator]();
      return source
    }

    extend(def) {
      return this.constructor.extend.call(this, def);
    }

    static extend(def = {}) {
      let { name = "Layer", methods, statics, evaluate, transform, predicate, cache: Cache = Array } = def;

      let prev = this instanceof Function ? this : this.constructor;
      let data = this.data ?? this.constructor.data;
      let root = Object.getPrototypeOf(prev).prototype ? prev.root : this;
      let cache =  name === prev.name ? undefined : new Cache; // Don't create new cache on duplicate layers
      cache = undefined
      // if(name === "Filter") cache = undefined
      // Name is automatically stored with class
      let Layer = {
        [name]: class extends prev {
          static root = root;
          static data = data;
          static prev = prev;
          static cache = cache;

          [Symbol.iterator]() {

            // Reuse previous layer cache in case of duplicate layers
            if ((prev.cache?.length > 0 || prev.cache?.size > 0) && prev.name == name) {
              console.log("Accessing cache at", name );
              const iterator = prev.cache[Symbol.iterator]();
              return evaluate({ iterator, transform, predicate,testFlag:"test:"+name }); // Don't evaluate cache
            }

            // Else return cache in case of branching
            if (cache?.length > 0 || cache?.size > 0) {
              console.log("Cache hit at");
              return cache[Symbol.iterator]();
            }

            // Run main iterator
            const iterator = super[Symbol.iterator]();
            return evaluate({ iterator, transform, predicate, cache });
          }
        },
      }[name];

      if (methods) Object.assign(Layer.prototype, methods);
      if (statics) Object.assign(Layer, statics);

      return Layer;
    }
  }

  function mapper(config) {
    const { name, testFlag,cache, iterator, transform } = config;

    return {
      next: () => {
          
        let { value, done } = iterator.next();
        // if (done) console.log("Mapper Cache", cache);
        value = transform(value);
        if (cache) cache.push(value);

        return { value, done };
      },
    };
  }

  function filter(config) {
    const { testFlag,cache, iterator, predicate } = config;

    return {
      next: () => {
        while (true) {
          let { value, done } = iterator.next();
          if (done) {
            // console.log("Filter Cache", cache);
            return { value: undefined, done: true }; // End of iteration
          }
          if (cache && !cache.has(value) && predicate(value)) {
            cache.add(value); // Add the value to the seen Set
            return { value, done }; // Pass the value through
        
          } else if (predicate(value)) {
            return { value, done };
          }
        }
      },
    };
  }

  function* mapGen(config) {
    const { cache, iterator, transform } = config;
    for (let item of iterator) {
      item = transform(item);
      if (cache) cache.push(item);
      yield item
    }
  }

  function* filterGen(config) {
    const { cache, iterator, predicate } = config;
    for (const item of iterator) {
      if (cache) {
        if (!cache.has(item) && predicate(item)) {
          cache.add(item); // Add the value to the seen Set
          yield item // Pass the value through
        }
      } else if (predicate(item)) { // Else iterating over layer cache
        yield item
      }
    }
  }

  let t1 = performance.now()
  let main = new Base(setSeqA)
    .extend({
      name: "Filter",
      cache: Set, // Use Set as the cache to track seen values
      predicate: (v) => v < testMax,
      evaluate: filter,
    })
    .extend({
      name: "Mapper",
      cache: Array,
      transform: (d) => (d * 2),
      evaluate: mapper,
    })
    .extend({
      name: "Mapper",
      cache: Array,
      transform: (d) => d * 2,
      evaluate: mapper,
    })
    .extend({
      name: "Mapper",
      cache: Array,
      transform: (d) => d * 2,
      evaluate: mapper,
    })
    .extend({
      name: "Filter",
      cache: Set, // Use Set as the cache to track seen values
      predicate: (v) => v > 0,
      evaluate: filter,
    })
    .extend({
      name: "Filter",
      cache: Set, // Use Set as the cache to track seen values
      predicate: (v) => v < 8000000,
      evaluate: filter,
    })

  let out = new main(Set)
  let out2 = new main(Set)

  let fork = new main(Base)    
    .extend({
      name: "Mapper",
      cache: Array,
      transform: (d) => d * 16,
      evaluate: mapper,
    }) 
    .extend({
      name: "Filter",
      cache: Set, // Use Set as the cache to track seen values
      predicate: (v) => v < 1000,
      evaluate: filter,
    })

  let out3 = new fork(Set)


  let t2 = performance.now()
  let arr = new Set(Array.from(setSeqA).filter(d=>d<testMax).map(d=> d * 2).map(d=> d * 2).map(d=> d * 2)
        .filter(d=>d>0) .filter(d=>d<80000000))
  // ((d * 2)*2)*2
  let arr2 = new Set(Array.from(setSeqA).filter(d=>d<testMax).map(d=> d * 2).map(d=> d * 2).map(d=> d * 2)
        .filter(d=>d>0) .filter(d=>d<80000000))
  let t3 = performance.now()


  let output = {
    lazy: ~~(t2 - t1),    native: ~~(t3 - t2),
    main: new main(Base),
    out,
    out2,
    out3,
    arr,arr2,
    temp:new fork(Base)
    
  };


  console.log(output)

  function shuffleArray(array) {
    for (let i = array.length - 1; i >= 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array
  }
