module util from "util";

export var has = Function.prototype.call.bind(Object.prototype.hasOwnProperty);

export function extend(dest) {
  // NOTE: jstransform miscompiles ...src, so we have to do it manually here.
  var srcs = [].slice.call(arguments, 1).reverse();

  srcs.forEach((src) => {
    for (var k in src) {
      if (!has(src, k)) {
        continue;
      }

      dest[k] = src[k];
    }
  });

  return dest;
}

export function repr(obj, options) {
  return util.inspect(obj, options);
}
