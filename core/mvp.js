class Operator {
  #data;
  #context;

  constructor(input) {
    // Branch the chain if input argument is a Builder class => instantiate or not?

    // Factory function prevents identity checking here...

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

    if (/*input === Operator*/ input?.name === Operator.name) {
      let prev = this;
      let data = Array.from(prev); // => initiates cache

      let branch = prev.constructor.name;
      let allOps = [
        "Inherited",
        this.walk(prev)
          .map((d) => d.constructor.name)
          .reduce((acc, operation) => {
            return `${operation}(${acc})`;
          }, "input"),
      ].join(":");

      let instance = new Operator(data);

      return new {
        [branch]: class Branch extends instance.constructor {
          get branch() {
            return true;
          }
          get layerOps() {
            return allOps;
          }
        },
      }[branch](data);
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

  get data() {
    return this.#data;
  }

  set data(value) {
    this.#data = value;
  }

  // Iterator strategy 1
  /**[Symbol.iterator]() {
    const iterator = this.data[Symbol.iterator]();
    while (true) {
      const { value, done } = iterator.next();
      if (done) break;
      yield value;
    }
  }*/

  // Iterator strategy 2
  /*[Symbol.iterator]() {
    const dataIterator = this.data[Symbol.iterator]();
    let done = false;

    return {
      next: () => {
        if (done) {
          return { value: undefined, done: true };
        }
        const result = dataIterator.next();
        if (result.done) {
          done = true;
        }
        return result;
      }
    };
  }*/

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

  get context() {
    return Object.getPrototypeOf(this).constructor.name;
  }

  // Static method: map
  // Dynamically extends current instance
  static map(op) {
    const prev = this; // Current class in the chain
    const cache = []; // Private cache => only available in closure
    return {
      Mapper: class extends prev {
        /**[Symbol.iterator]() {
          const iterator = super[Symbol.iterator]();
          while (true) {
            const { value, done } = iterator.next();
            if (done) break;
            yield op(value);
          }
        }*/

        getCache() {
          return cache;
        }

        // Strategy 2 => slightly faster
        [Symbol.iterator]() {
          // Return cache on secondary runs
          if (cache.length > 0) {
            return cache[Symbol.iterator]();
          }
          const iterator = super[Symbol.iterator]();

          let hit;
          return {
            next() {
              while (true) {
                const { value, done } = iterator.next();

                if (done) {
                  return { value: undefined, done: true };
                }
                hit = op(value);
                cache.push(hit);
                return { value: hit, done: false };
              }
            },
          };
        }
      },
    }.Mapper;
  }

  // Static method: filter
  // Dynamically extends current instance
  static filter(op) {
    const prev = this; // Current class in the chain
    const cache = []; // new Map(); // Private cache => only available in closure
    return {
      Filter: class extends prev {
        // Strategy 1 => More concise
        /**[Symbol.iterator]() {
          const iterator = super[Symbol.iterator]();
          while (true) {
            const { value, done } = iterator.next();
            if (done) break;
            if (op(value)) {
              yield value;
            }
          }
        }*/

        getCache() {
          return cache;
        }

        // Strategy 2 => slightly faster
        [Symbol.iterator]() {
          // Return cache on secondary runs
          if (cache.length > 0) {
            return cache[Symbol.iterator]();
          }
          const iterator = super[Symbol.iterator]();

          let hit;
          return {
            next() {
              while (true) {
                const { value, done } = iterator.next();
                if (done) {
                  return { value: undefined, done: true };
                }

                if ((hit = op(value))) {
                  cache.push(value);
                  return { value, done: false };
                }
              }
            },
          };
        }
      },
    }.Filter;
  }

  static factory() {
    return new Function(`return ${this.toString()}`)();
  }

  walk(from) {
    // walking the prototype chain

    let chain = from ?? this;
    let ops = [];
    while (chain !== null && Object.getPrototypeOf(chain) instanceof Operator) {
      chain = Object.getPrototypeOf(chain); // Safely move up the prototype chain
      ops.push(chain);
    }
    ops = ops.reverse();
    return ops;
  }
}

/* How to use */

let Query = Operator.factory();

let t1 = performance.now();
let log = false;

let branch = new Query(list) // Initiate a branch
  .map(([k, v]) => [k * 4, v])
  .filter(([k, v]) => (log ? console.log(v) : undefined, v % 8 === 0 && k <= 2048));
// .filter((v) => Math.random() >0.95)

let forked = new branch(Operator) // Pass a Class named Operator to indicate a branch
  .map(([k, v]) => [k * 4, v])
  .filter(([k, v]) => (log ? console.log(k) : undefined, k <= 2048))
  .map(([k, v]) => [k * 2, v]);
// .map(([k,v]) => [k * 2,v])
// .map(([k,v]) => [(k * 2),{}]);

let result = new branch(Map);
let result2 = new forked(Map);

let out = {
  time: ~~(performance.now() - t1),
  result,
  result2,
  branch: Object.getPrototypeOf(new forked()),
};

console.log(out);
