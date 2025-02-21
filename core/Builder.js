class Base {
  
  #debug = false;
  constructor(input) {
    if (input === Base) {
      // Aim to create a new branch that benefits from cached results
      return new (class Branch extends Base {})(this);
    } else if (input === Array) {
      return Array.from(this);
    } else if (input === Set) {
      if (this.constructor.Set) return new Set(this.constructor.Set);
      else return consume(this, input);
    } else if (input === Map) {
      if (this.constructor.Map) return new Set(this.constructor.Map);
      else return consume(this, input);
    } else if (input instanceof Base) {
      this.constructor.data = input; // import existing branch
    } else if (input) {
      this.data = input;
    }
  }

  [Symbol.iterator]() {
    let source = (this.data ?? this.constructor.data)[Symbol.iterator]();
    return source;
  }

  static extend(def = {}, debug = false) {
    
    // Setup reference chain
    let prev = this instanceof Function ? this : this.constructor;
    let data = this.data ?? this.constructor.data;
    let root = Object.getPrototypeOf(prev).prototype ? prev.root : this;
    debug = prev.debug ?? debug;

    let {
      name = "Layer",
      methods,
      statics,
      evaluate,
      transform,
      predicate,
      comparator,
      cache: Cache = Array,
    } = def;

    // Initiate new cache layer if class extensions don't match
    let init = name !== prev.name;
    let cache = init ? new Cache() : prev.cache;

    // Name is stored with class
    let Layer = {
      [name]: class extends prev {
        static root = root;
        static data = data;
        static prev = prev;
        static cache = cache;
        static debug = debug;

        [Symbol.iterator]() {
          // Run main iterator
          const iterator = super[Symbol.iterator]();
          return evaluate({
            init,
            name,
            iterator: iterator,
            comparator,
            transform,
            predicate,
            cache,
            debug,
          });
        }
      },
    }[name];

    if (methods) Object.assign(Layer.prototype, methods);
    if (statics) Object.assign(Layer, statics);

    return Layer;
  }

  extend(def) {
    return this.constructor.extend.call(this, def, this.#debug);
  }
}
