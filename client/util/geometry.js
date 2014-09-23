export class Vector2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  copy() {
    return new Vector2(this.x, this.y);
  }

  map(f) {
    var out = this.copy();
    out.x = f(out.x);
    out.y = f(out.y);
    return out;
  }

  elementwise(f, other) {
    var out = this.copy();
    out.x = f(out.x, other.x);
    out.y = f(out.y, other.y);
    return out;
  }

  scale(k) {
    var out = this.copy();
    out.x *= k;
    out.y *= k;
    return out;
  }

  offset(other) {
    var out = this.copy();
    out.x += other.x;
    out.y += other.y;
    return out;
  }

  negate() {
    var out = this.copy();
    out.x = -out.x;
    out.y = -out.y;
    return out;
  }

  magnitudeSquared() {
    return this.x * this.x + this.y * this.y;
  }

  magnitude() {
    return Math.sqrt(this.magnitudeSquared());
  }

  normalized() {
    return this.copy().scale(1 / this.magnitude());
  }

  equals(other) {
    return this.x === other.x && this.y === other.y;
  }

  toString() {
    return "Vector2(" + this.x + ", " + this.y + ")";
  }
}

export class Vector3 {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  copy() {
    return new Vector3(this.x, this.y, this.z);
  }

  map(f) {
    var out = this.copy();
    out.x = f(out.x);
    out.y = f(out.y);
    out.z = f(out.z);
    return out;
  }

  elementwise(f, other) {
    var out = this.copy();
    out.x = f(out.x, other.x);
    out.y = f(out.y, other.y);
    out.z = f(out.z, other.z);
    return out;
  }

  scale(k) {
    var out = this.copy();
    out.x *= k;
    out.y *= k;
    out.z *= k;
    return out;
  }

  offset(other) {
    var out = this.copy();
    out.x += other.x;
    out.y += other.y;
    out.z += other.z;
    return out;
  }

  negate() {
    var out = this.copy();
    out.x = -out.x;
    out.y = -out.y;
    out.z = -out.z;
    return out;
  }

  magnitudeSquared() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  magnitude() {
    return Math.sqrt(this.magnitudeSquared());
  }

  normalized() {
    return this.scale(1 / this.magnitude());
  }

  equals(other) {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }

  toString() {
    return "Vector3(" + this.x + ", " + this.y + ", " + this.z + ")";
  }
}

export class Rectangle {
  constructor(left, top, width, height) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
  }

  copy() {
    return new Rectangle(this.left, this.top, this.width, this.height);
  }

  getLeftTop() {
    return new Vector2(this.left, this.top);
  }

  getRightBottom() {
    return new Vector2(this.getRight(), this.getBottom());
  }

  getSize() {
    return new Vector2(this.width, this.height);
  }

  getRight() {
    return this.left + this.width;
  }

  getBottom() {
    return this.top + this.height;
  }

  distanceTo(other) {
    var [mostLeft, mostRight] =
        this.left < other.left ? [this, other] : [other, this];
    var xDist = Math.max(0, mostRight.left - mostLeft.getRight());

    var [upper, lower] =
        this.top < other.top ? [this, other] : [other, this];
    var yDist = Math.max(0, lower.top - upper.getBottom());

    return new Vector2(xDist, yDist).magnitude();
  }

  intersect(other) {
    var left = Math.max(this.left, other.left);
    var right = Math.min(this.getRight(), other.getRight());

    if (right <= left) {
      return null;
    }

    var top = Math.max(this.top, other.top);
    var bottom = Math.min(this.getBottom(), other.getBottom());

    if (bottom <= top) {
      return null;
    }

    return Rectangle.fromCorners(left, top, right, bottom);
  }

  contains(other) {
    return this.left <= other.left && this.getRight() >= other.getRight() &&
           this.top <= other.top && this.getBottom() >= other.getBottom();
  }

  offset(vec) {
    var out = this.copy();
    out.left += vec.x;
    out.top += vec.y;
    return out;
  }

  scale(k) {
    var out = this.copy();
    out.width *= k;
    out.height *= k;
    return out;
  }

  equals(other) {
    return this.left === other.left && this.top === other.top &&
           this.width === other.width && this.height === other.height;
  }

  toString() {
    return "Rectangle(" + this.left + ", " + this.top + ", " +
                          this.width + ", " + this.height + ")";
  }
}

Rectangle.fromCorners = (left, top, right, bottom) =>
    new Rectangle(left, top, right - left, bottom - top);
