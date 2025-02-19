class Operator {
  #data;

  constructor(input) {
    // Take previous input chain as input to new Builder (branching)
    if (input instanceof Operator) {
      this.data = input.constructor.data;
      // this.constructor.data = Array.from(this) // => freeze data: how to freeze on first go

      // Forward iterator to dynamic subclass (E.g. Filter, Mapper)
    } else if (Object.getPrototypeOf(this) instanceof Operator) {
      this.data = this.constructor.data;

      // Initiate new Builder
    } else {
      this.data = this.constructor.data = input; // Object.freeze(input); => don't mind freezing iterables
    }

    // Branch the chain if input argument is a Builder class => instantiate or not?
    // Factory function prevents identity checking here...

    if (/*input === Operator*/ input?.name === Operator.name) {
      let prev = this;

      let branch = prev.constructor.name;
      let allOps = prev.getOps(this);

      let squashed = Array.from(prev); // => triggers cache
      let instance = new Operator(squashed);

      return new {
        [branch]: class Branch extends instance.constructor /*prev.constructor*/ {
          get branch() {
            return true;
          }
          get layerOps() {
            return allOps;
          }
        }
      }[branch](instance /*squashed*/ /*prev*/); // Pass new instance as argument to indicate branching
    }

    // Return results if input argument is a native accumulator class
    if (input === Array) {
      let result = Array.from(this);
      return result;
    } else if (input === Map) {
      return new Map(this);
    } else if (input === Set) {
      return new Set(this);
    }
  }

  get context() {
    return Object.getPrototypeOf(this).constructor.name;
  }

  get data() {
    return this.#data;
  }

  set data(value) {
    this.#data = value;
  }

  // Iterator strategy 3
  next() {
    const result = this[Symbol.iterator].next();
    if (result.done) {
      return { value: undefined, done: true };
    }
    return result;
  }

  [Symbol.iterator]() {
    return this.data[Symbol.iterator]();
  }

  // Instance method: map
  map(op) {
    return this.constructor.map.call(this.constructor, op);
  }

  // Instance method: filter
  filter(op) {
    return this.constructor.filter.call(this.constructor, op);
  }

  // Instance method: sorter
  sort(op) {
    return this.constructor.sort.call(this.constructor, op);
  }

  // Static method do not take external options yet
  static map(op) {
    return this.extendClass({
      name: "Mapper",
      transform: op,
      cache: [],
      cacheEnabled: true,
      nextFunc: Operator.shaper
    });
  }

  static filter(op) {
    return this.extendClass({
      name: "Filter",
      predicate: op,
      cache: [],
      cacheEnabled: true,
      nextFunc: Operator.shaper
    });
  }

  static sort(comparator = (a, b) => a - b) {
    return this.extendClass({
      name: "Sorter",
      comparator,
      cache: [],
      cacheEnabled: true, // Cache is used to store the sorted portion
      nextFunc: Operator.sorter
    });
  }

  static shaper(options) {
    const { iterator, comparator, transform, predicate, cache, cacheEnabled } =
      options;

    // Determine the iterator logic upfront
    let iteratorLogic;

    if (transform && predicate) {
      // Both transform and predicate are provided
      iteratorLogic = (value) => {
        const transformed = transform(value);
        return predicate(value) ? transformed : undefined;
      };
    } else if (transform) {
      // Only transform is provided (map-like behavior)
      iteratorLogic = transform;
    } else if (predicate) {
      // Only predicate is provided (filter-like behavior)
      iteratorLogic = (value) => (predicate(value) ? value : undefined);
    } else {
      // Neither transform nor predicate is provided (identity behavior)
      iteratorLogic = (value) => value;
    }
    return {
      next() {
        // General filter/mapper logic
        while (true) {
          const { value, done } = iterator.next();
          if (done) {
            return { value: undefined, done: true };
          }

          const result = iteratorLogic(value);

          if (result !== undefined) {
            if (cacheEnabled) {
              cache.push(result);
            }
            return { value: result, done: false };
          }
        }
      }
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
              break;
            }
            cache.push(value);
          }
          cache.sort(comparator);
        }

        // Yielding Phase: Return elements from the sorted cache
        if (index < cache.length) {
          return { value: cache[index++], done: false };
        }

        // If the cache is exhausted and sorting is complete, signal done
        return { value: undefined, done: true };
      }
    };
  }

  static extendClass(options) {
    const { name, nextFunc, cache, cacheEnabled, ...rest } = options;

    const prev = this; // => Current class in the chain
    let layer = {

      [name]: class extends prev {
        [Symbol.iterator]() {
          if (cacheEnabled && cache.length > 0) {
            return cache[Symbol.iterator]();
          }

          const iterator = super[Symbol.iterator]();
          return nextFunc({
            iterator,
            cache,
            cacheEnabled,
            ...rest
          });
        }

        getCache() {
          return cache;
        }
      }
    };

    return layer[name];
  }

  // Walk the prototype chain
  walk(from) {
    let chain = from ?? this;
    let ops = [];
    while (chain !== null && Object.getPrototypeOf(chain) instanceof Operator) {
      chain = Object.getPrototypeOf(chain);
      ops.push(chain);
    }
    ops = ops.reverse();
    return ops;
  }

  // Convert operations to string
  getOps(from) {
    return `Inherited:${this.walk(from ?? this)
      .map((d) => d.constructor.name)
      .reduce((acc, operation) => {
        return `${operation}(${acc})`;
      }, "input")}`;
  }

  static factory() {
    return new Function(`return ${this.toString()}`)();
  }
}
