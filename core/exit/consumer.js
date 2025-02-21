function consume(that, Type, {bufferSize = 2048 + 1024, debug = false } = {}) {
  const result = new Type();
  if (debug) console.log("Building set");

  let i = 0; // Current position in the buffer
  const buffer = Array(bufferSize); // Preallocate buffer

  if (Type === Set) {
    for (const item of that) {
      buffer[i++] = item;
      if (i === bufferSize) {
        for (let j = 0; j < i; j++) {
          result.add(buffer[j]);
        }
        i = 0;
      }
    }

    // Flush remaining items
    for (let j = 0; j < i; j++) {
      result.add(buffer[j]);
    }
    return (that.constructor.Set = result);
  } else if (Type === Map) {
    for (const item of that) {
      buffer[i++] = item;
      if (i === bufferSize) {
        for (let j = 0; j < i; j++) {
          result.set(buffer[j][0], buffer[j][1]);
        }
        i = 0;
      }
    }

    // Flush remaining items
    for (let j = 0; j < i; j++) {
      result.set(buffer[j][0], buffer[j][1]);
    }

    return (that.constructor.Map = result);
  }
}
