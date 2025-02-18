class Operator {
  
  #data;
  constructor(input) {

    // Take previous input chain as input to new Builder
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
      let allOps = this.getOps(prev);

      let squashed = Array.from(prev); // => triggers cache
      let instance = new Operator(squashed);

      return new {
        [branch]: class Branch extends /*instance.constructor*/ prev.constructor {
          get branch() {
            return true;
          }
          get layerOps() {
            return allOps;
          }
        }
      }[branch](/*squashed*/prev);
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


  // Does not take external options yet
  static map(op) {
    return this.extendClass({
      name: "Mapper",
      transform: op,
      cacheEnabled: true
    });
  }

  static filter(op) {
    return this.extendClass({
      name: "Filter",
      predicate: op,
      cacheEnabled: true 
    });
  }

  static extendClass(options) {
    const { name, transform, predicate, cacheEnabled } = options;
    const prev = this; // Current class in the chain
    const cache = [];
    return {
      [name]: class extends prev {
        [Symbol.iterator]() {
          if (cacheEnabled && cache.length > 0) {
            return cache[Symbol.iterator]();
          }

          const iterator = super[Symbol.iterator]();

          return {
            next: () => {
              while (true) {
                const { value, done } = iterator.next();
                if (done) {
                  return { value: undefined, done: true };
                }

                let result = value;
                if (transform) {
                  result = transform(value); // Apply transformation (for map)
                }

                if (!predicate || predicate(value)) {
                  if (cacheEnabled) {
                    cache.push(result);
                  }
                  return { value: result, done: false };
                }
              }
            }
          };
        }

        getCache() {
          return cache;
        }
      }
    }[name];
  }

  static factory() {
    return new Function(`return ${this.toString()}`)();
  }

  // walk the prototype chain
  walk(from) {
    let chain = from ?? this;
    let ops = [];
    while (chain !== null && Object.getPrototypeOf(chain) instanceof Operator) {
      chain = Object.getPrototypeOf(chain); // Safely move up the prototype chain
      ops.push(chain);
    }
    ops = ops.reverse();
    return ops;
  }

  getOps(from) {
    return [
      "Inherited",
      this.walk(from ?? this)
        .map((d) => d.constructor.name)
        .reduce((acc, operation) => {
          return `${operation}(${acc})`;
        }, "input")
    ].join(":");
  }
}
