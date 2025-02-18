# Operator

Lazy data structure that allows fluent chaining and caching of values from previous operations. 
Each 'layer' can be branched, which squashes the operations and output into a fresh Operator instance.
Immutability not fully handled yet, however, it is difficult to mutate the output data due to the fact 
that each chained function returns a Class instead of data. 
This requires you to call 'new' before being able to access results.

Example:

``` javascript

  // Generate some data
  let data = new Map(Array.from({ length: 1000 }, (_, i) => [i,i]))

  // Factory function to create Fresh operator instances
  let Factory = Operator.factory() 
  let t1 = performance.now();
  let iterations = 0

  // Create a main by using the Factory function
  let branch = new Factory(data)
    .map(([k,v]) => (iterations++,[k * 4,v])) // => side-effect to show n-iterations
    .filter(([k,v]) => (v % 2 === 0 && k <= 2048))
    .filter((v) => Math.random() > 0.9)

  // Pass an Operator class to squash operations
  let forked = new branch(Operator) 
   .map(([k,v]) => [k * 4,v])
   .filter(([k,v]) => (k <= 2048))
   .map(([k,v]) => [k * 2,v])
   .filter(([k,v]) => (v> 32))

  // Pass Array, Set or Map as argument to accumulate results
  let result = new branch(Array); 
  let result2 = new forked(Map)

  // Inspect lazy operations
  let out = {
    time: ~~(performance.now() - t1),
    result, result2,

    // Create a new forked copy without branching
    branch: new forked, 
    iterations
  };

  console.log(out)

```
