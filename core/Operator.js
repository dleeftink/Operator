class Operator {
  #data;
  #debug = true;

  constructor(input) {
    if (input === undefined) throw new Error("No input provided");

    // Create branch from previous input
    if (/*input instanceof Operator &&*/ this.constructor.name === "Branch") {
      if (this.#debug) console.log("Post branch", input);     

      // The automatic cache hit mechanism is overridden when calling /input.getCache()
      // input/input.getCache() leads to fastest copies
      this.constructor.data = input//.getCache(); 

      // Forward iterator to dynamic subclass (E.g. Filter, Mapper)
    } else if (Object.getPrototypeOf(this) instanceof Operator) {
      this.#data = this.constructor.data;
      // Initiate new Operator
    } else {
      this.constructor.data = input; // Object.freeze(input); => don't mind freezing iterables
    }

    // Branch the chain if input argument is a Builder class => instantiate or not?
    // Factory function prevents identity checking here...
    if (/*input === Operator*/ input?.name === Operator.name) {
      let prev = this;
      if (this.#debug) console.log("Pre branch", prev);
      let branch = prev.constructor.name;
      let signature = prev.getSignature(this);

      // let squashed = Array.from(prev); // => triggers cache
      // let instance = new Operator(prev);

      return new {
        [branch]: class Branch extends Operator {
          branch = true
          signature = signature;
        },
      }[branch](prev /*squashed /*prev*/); // Pass new instance as argument to indicate branching
    }

    // Return results if input argument is a native accumulator class
    // To do: add register option for converting to custom classes (e.g. Tree, Graph, etc.)
    if (input === Array) {
      let result = input.from(this);
      return result;
    } else if (input === Map) {
      const result = new input;
      if(this.#debug) console.log("Building map")

      let i = 0, bufferSize = 2048 + 1024;
      const buffer = Array(bufferSize); 
      for (const item of this) {
        buffer[i++] = item; 

        if (buffer.length === bufferSize) {
          while (i > 0) {   i--; 
            result.set(buffer[i][0], buffer[i][1]);
          } buffer.length = 0; 
        }
      }

      while (i > 0) { i--; 
        result.set(buffer[i][0], buffer[i][1]);
      };
      
      return result;
    } else if (input === Set) {
      return new Set(this);
    }
  }

  // Custom iterator logic
  [Symbol.iterator]() {
    return this.#data[Symbol.iterator]();
  }

  next() {
    return this[Symbol.iterator]().next();
  }

  // Getters and setters
  get context() {
    return Object.getPrototypeOf(this).constructor.name;
  }

  // Instance method: map
  // Enables fluent chaining on class instance
  map(op) {
    return this.constructor.map.call(this.constructor, op);
  }

  // Instance method: filter
  // Enables fluent chaining on class instance
  filter(op) {
    return this.constructor.filter.call(this.constructor, op);
  }

  // Instance method: sorter
  // Enables fluent chaining on class instance
  sort(op) {
    return this.constructor.sort.call(this.constructor, op);
  }

  // Static method: extend current with Mapper class
  // Enables fluent chaining on dynamically returned subclasses
  static map(op) {
    return this.extendClass({
      name: "Mapper",
      transform: op,
      cache: Array,
      cacheEnabled: true,
      iterType: Operator.shaper,
    });
  }

  // Static method: extend current with Filter class
  // Enables fluent chaining on dynamically returned subclasses
  static filter(op) {
    return this.extendClass({
      name: "Filter",
      predicate: op,
      cache: Array,
      cacheEnabled: true,
      iterType: Operator.shaper,
    });
  }

  // Static method: extend current with Sorter class
  // Enables fluent chaining on dynamically returned subclasses
  static sort(comparator = (a, b) => a - b) {
    return this.extendClass({
      name: "Sorter",
      comparator,
      cache: Array,
      cacheEnabled: true,
      iterType: Operator.sorter,
    });
  }

  static shaper(options) {
    const { ctx, iterator, comparator, transform, predicate, cache, cacheEnabled, forwardCache } = options;

    // Determine the iterator logic upfront
    let shape;
    if (transform && predicate) {
      shape = (value) => {
        const transformed = transform(value);
        return predicate(value) ? transformed : undefined;
      };
    } else if (transform) {
      shape = transform;
    } else if (predicate) {
      shape = (value) => (predicate(value) ? value : undefined);
    } else {
      shape = (value) => value;
    }

    return {
      next() {
        // Apply shaper to values
        while (true) {
          const { value, done } = iterator.next();
          if (done) {
            // console.log("cached", Operator.shaper.name);
            return { value: undefined, done: true };
          }

          const result = shape(value);
          if (result !== undefined) {
            if (cacheEnabled) {
              cache.push(result);
            }
            return { value: result, done: false };
          }
        }
      },
    };
  }

  static sorter(options) {
    const { iterator, comparator, transform, predicate, cache, cacheEnabled } = options;

    // Track whether the input iterator is exhausted
    let doneSorting = false;
    let index = 0;

    return {
      next() {
        // Process values on empty cache
        if (!doneSorting) {
          while (true) {
            const { value, done } = iterator.next();
            if (done) {
              doneSorting = true; // Mark sorting as complete
              cache.sort(comparator);
              break;
            }
            cache.push(value);
          }
        }

        // Yielding Phase: Return elements from the sorted cache
        if (index < cache.length) {
          return { value: cache[index++], done: false };
        }

        // If the cache is exhausted and sorting is complete, signal done
        return { value: undefined, done: true };
      },
    };
  }

  // Dynamic subclassing method
  static extendClass(options) {
    const { name, iterType: nextFunc, cache: Cache, cacheEnabled, ...rest } = options;

    /*class LayerCache extends Cache {
      [Symbol.iterator]() {
        const iterator = super[Symbol.iterator]();
        return nextFunc({
          iterator,
          cacheEnabled:false,
        });
      }
    }*/

    const prev = this; // => Previous class in the chain
    const cache = new Cache(); /*prev.iterType === nextFunc ? prev.layerCache : new LayerCache;
  
    console.log(prev.iterType?.name ?? prev.name, nextFunc.name,prev.iterType === nextFunc ? prev.layerCache : null)*/

    const layer = {
      [name]: class extends prev {
        
        static iterType = nextFunc;
        static layerCache = cache;
        
        [Symbol.iterator]() {
          if (cacheEnabled && (cache.length > 0 || cache.size > 0)) {
            if (this.#debug) console.log("cache hit at", this.constructor.name, "first val", cache[0]);
            return cache[Symbol.iterator]();
          }
          if (this.#debug) console.log("Iterating at", name);

          const iterator = super[Symbol.iterator]();
          return nextFunc({
            ctx: this,
            iterator,
            cache,
            cacheEnabled,
            ...rest,
          });
        }

        getCache() {
          return this.constructor.layerCache;
        }

      },
    };

    return layer[name];
  }

  // Build new Operator Class reference
  static factory() {
    return new Function(`return ${this.toString()}`)();
  }


  // Utility function to walk from current node to constructor
  walk(from) {
    let chain = from ?? this;
    let ops = [];
    while (chain !== null && Object.getPrototypeOf(chain) instanceof Operator) {
      chain = Object.getPrototypeOf(chain);
      ops.push(chain);
    }
    return ops.reverse();
  }

  // Convert operations to string
  getSignature(from) {
    return `Inherited:${this.walk(from ?? this)
      .map((d) => d.constructor.name)
      .reduce((acc, operation) => {
        return `${operation}(${acc})`;
      }, "input")}`;
  }
}
