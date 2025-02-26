// Variation of the Builder base class
// Compresses operations into a single layer instead

class Base {
  
  #debug = false;
  constructor(input, debug) {
    if (input === Base) {
      // Create a new branch that benefits from cached results
      return new (class Branch extends Base {})(this);
    } else if (input === Array) {
      // Accumulate to array
      if (this.constructor.Array) return new Set(this.constructor.Array);
      return (this.constructor.Array = Array.from(this));
    } else if (input === Set) {
      // Accumulate to set
      if (this.constructor.Set) return new Set(this.constructor.Set);
      return consume(this, input);
    } else if (input === Map) {
      // Accumulate to map
      if (this.constructor.Map) return new Map(this.constructor.Map);
      return consume(this, input);
    } else if (input instanceof Base) {
      // Initiate a branch
      if (debug) console.log("Hoisting cache from", input, input.constructor.cache);
      this.constructor.data = input /*.constructor.cache*/; // import existing branch
    } else if (input) {
      // Else assume input is a data argument
      this.data = input;
    }
    if (debug) this.#debug = debug;
  }

  static extend(next = {}, debug = false) {
    // Setup reference chain
    let prev = this instanceof Function ? this : this.constructor;
    let data = this.data ?? this.constructor.data;
    let root = Object.getPrototypeOf(prev).prototype ? prev.root : this;
    debug = prev.debug ?? debug;

    let { name = "Layer", methods, useCache, statics, evaluate, transform, predicate, comparator, cache: Cache = Array } = next;

    // Determine if we need to initialize a new layer
    let init = name !== prev.name;

    // Retrieve or create the cache
    let cache = init ? new Cache() : prev.cache; cache.enabled = true;
    if (init && prev.cache) prev.cache.enabled = prev.useCache ?? false;

    let Layer;
    if (init) {
      Layer = {
        [name]: class extends prev {
          static root = root;
          static data = data;
          static prev = prev;
          static cache = cache;
          static debug = debug;
          static useCache = useCache;

          static evaluate = evaluate;
          static transform = transform;
          static predicate = predicate;
          static comparator = comparator;

          static compose = function (config) {
            let { evaluate, ...args } = config;
            return evaluate(args);
          };

          [Symbol.iterator]() {
            // Use the layer cache
            if (cache.size || cache.length) {
              if (debug) console.log("cache hit at", name, (predicate ?? transform ?? comparator)?.toString());
              return cache[Symbol.iterator]();
            }

            const iterator = super[Symbol.iterator]();
            return this.constructor.compose({
              init,name,debug,cache,
              evaluate,iterator,
              transform: Layer.transform,
              predicate: Layer.predicate,
              comparator: Layer.comparator,
            });
          }
        },
      }[name];
    } else {
      
      Layer = prev;
      
      // Combine previous with next operation
      if (transform) Layer.transform = composeTransform(prev.transform, next.transform);
      if (predicate) Layer.predicate = composePredicate(prev.predicate, next.predicate);
      if (comparator) Layer.comparator = composeComparator(prev.comparator, next.predicate);
      
    }

    if (methods) Object.assign(Layer.prototype, methods);
    if (statics) Object.assign(Layer, statics);

    return Layer;
  }

  extend(def) {
    return this.constructor.extend.call(this, def, this.#debug);
  }

  [Symbol.iterator]() {
    let source = (this.data ?? this.constructor.data)[Symbol.iterator]();
    return source;
  }
}

// Decide: bind or not
function composePredicate(oldOp, newOp) {
  if (!oldOp) return newOp;
  if (!newOp) return oldOp;
  return function composed(v,i,n) {
    const newArg = oldOp(v,i, n);
    return newOp(newArg, i, n);
  };
}

function composeTransform(oldOp, newOp) {
  if (!oldOp) return newOp;
  if (!newOp) return oldOp;
  return function composed(v,i) {
    const newArg = oldOp(v, i);
    return newOp(newArg,i);
  }; //.bind(this);
}

function composeComparator(oldOp, newOp) {
  if (!oldOp) return newOp;
  if (!newOp) return oldOp;
  return function composed(a, b) {
    const oldResult = oldOp(a, b);
    if (oldResult !== 0) return oldResult;
    return newOp(a, b); 
  }
}
