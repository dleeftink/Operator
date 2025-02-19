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
    // To do: add register option for converting to custom classes (e.g. Tree, Graph, etc.)
    if (input === Array) {
      let result = Array.from(this);
      return result;
    } else if (input === Map) {
      return new Map(this);
    } else if (input === Set) {
      return new Set(this);
    }
  }

  // Utility function to walk from current node to constructor
  walk(from) {
    if (!this._walkCache) {
      let chain = from ?? this;
      let ops = [];
      while (
        chain !== null &&
        Object.getPrototypeOf(chain) instanceof Operator
      ) {
        chain = Object.getPrototypeOf(chain);
        ops.push(chain);
      }
      this._walkCache = ops.reverse();
    }
    return this._walkCache;
  }

  // Custom iterator logic
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

  // Getters and setters
  get context() {
    return Object.getPrototypeOf(this).constructor.name;
  }

  get data() {
    return this.#data;
  }

  set data(value) {
    this.#data = value;
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
      cache: [],
      cacheEnabled: true,
      nextFunc: Operator.shaper
    });
  }

  // Static method: extend current with Filter class
  // Enables fluent chaining on dynamically returned subclasses
  static filter(op) {
    return this.extendClass({
      name: "Filter",
      predicate: op,
      cache: [],
      cacheEnabled: true,
      nextFunc: Operator.shaper
    });
  }

  // Static method: extend current with Sorter class
  // Enables fluent chaining on dynamically returned subclasses
  static sort(comparator = (a, b) => a - b) {
    return this.extendClass({
      name: "Sorter",
      comparator,
      cache: [],
      cacheEnabled: true,
      nextFunc: Operator.sorter
    });
  }

  static shaper(options) {
    const { iterator, comparator, transform, predicate, cache, cacheEnabled } =
      options;

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
      }
    };
  }

  static sorter(options) {
    const { iterator, comparator, transform, predicate, cache, cacheEnabled } =
      options;

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
      }
    };
  }

  // Dynamic subclassing method
  static extendClass(options) {
    const { name, nextFunc, cache, cacheEnabled, ...rest } = options;

    const prev = this; // => Previous class in the chain
    const layer = {
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

  // Build new Operator Class reference
  static factory() {
    return new Function(`return ${this.toString()}`)();
  }

  // Convert operations to string
  getOps(from) {
    return `Inherited:${this.walk(from ?? this)
      .map((d) => d.constructor.name)
      .reduce((acc, operation) => {
        return `${operation}(${acc})`;
      }, "input")}`;
  }
}
