class Vector2 {
    static down = new Vector2(0, -1);
    static left = new Vector2(-1, 0);
    static negativeInfinity = new Vector2(-Infinity, -Infinity);
    static right = new Vector2(1, 0);
    static up = new Vector2(0, 1);
    static zero = new Vector2(0, 0);

    constructor (x, y) {
        this.x = x;
        this.y = y;
    }
}

class Cursor {
    constructor () {
        this.position = new Vector2(0, 0);
        this.velocity = new Vector2(0, 0);
    }

    setPosition(x, y) {
        this.position.x = x;
        this.position.y = y;
    }
}

class CursorFunctions {
    static mainUpdate(c, cb) {
        c.position.x += c.velocity.x;
        c.position.y += c.velocity.y;
        if (cb) cb(c);
        return c;
    }

    static setVelocity(c, x, y) {
        c.velocity = { x, y };
    }

    static setPosition(c, x, y) {
        c.position = { x, y };
    }
}

module.exports = {
    Vector2,
    Cursor,
    CursorFunctions
}
