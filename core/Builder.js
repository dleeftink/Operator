class Base {

    #debug = false;
    constructor(input,debug) {
      if (input === Base) {
        // Create a new branch that benefits from cached results
        return new (class Branch extends Base {})(this);
      } else if (input === Array) {
        if (this.constructor.Array) return new Set(this.constructor.Array);
        return (this.constructor.Array = Array.from(this));
      } else if (input === Set) {
        if (this.constructor.Set) return new Set(this.constructor.Set);
        return consume(this, input); 
      } else if (input === Map) {
        if (this.constructor.Map) return new Set(this.constructor.Map);
        return consume(this, input); 
      } else if (input instanceof Base) {
        if(debug) console.log("Hoisting cache from",input, input.constructor.cache)
        this.constructor.data = input/*.constructor.cache*/; // import existing branch
      } else if (input) {
        this.data = input;
      }
      if(debug) this.#debug = debug
    }

    static extend(next = {}, debug = false) {

      // Setup reference chain 
      let prev = this instanceof Function ? this : this.constructor;
      let data = this.data ?? this.constructor.data;
      let root = Object.getPrototypeOf(prev).prototype ? prev.root : this;
          debug = prev.debug ?? debug;

      let {
        name = "Layer",
        eager,
        methods,
        useCache,
        statics,
        evaluate,
        transform,
        predicate,
        comparator,
        cacheEnabled,
        cache: Cache = Array
      } = next;

      // Initiate new cache layer if class names don't match
      
      let init = name !== prev.name; 
      let cache = init ? new Cache : prev.cache; cache.enabled = true;
      
      // First layer can't have cache currently, but likely won't need it
      // Only cache the last layer or if secondary layers 'useCache' flag 

      if(init && prev.cache) prev.cache.enabled = (prev.useCache ?? false)

      // Name is dynamically assigned to class
      // Remember : While setup code is run in order
      // prototypes are ran outside in (while iterator inside out...)
      
      let Layer = ({
        [name]: class extends prev {
          static root = root;
          static data = data;
          static prev = prev;
          static cache = cache;
          static debug = debug;
          static useCache = useCache;

          [Symbol.iterator]() {

            // Use the layer cache
            if(cache.size || cache.length) {
              if(debug) console.log("Layer cache used at",name,(predicate ?? transform ?? comparator).toString())
              return cache[Symbol.iterator]()
            }
            
            // Run custom iterator
            const iterator = super[Symbol.iterator]();
            return evaluate({
              init,
              name,
              cache,
              debug,
              transform,
              predicate,
              comparator,
              cacheEnabled,
              iterator: iterator,
            });
          }
        }
      })[name];

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
