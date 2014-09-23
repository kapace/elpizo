module util from "util";

export function has(obj, field) {
  return Object.prototype.hasOwnProperty.call(obj, field);
}

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
