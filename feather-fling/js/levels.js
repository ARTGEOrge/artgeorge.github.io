/* Feather Fling — level data.
 *
 * World units are metres, x = 0 is the slingshot, y = 0 is the ground, y up.
 * Builders take the BOTTOM edge of what they place and return its top edge,
 * so structures stack flush without overlapping (overlaps make Box2D shove
 * pieces apart on the first frame). */
(function () {
  'use strict';
  var GAP = 0.01;

  function builder() {
    var p = [];
    var R = function (k) { return window.ART.BANDITS[k].r; };
    var b = {
      pieces: p,
      col: function (m, x, y, h, w) {
        w = w || 0.4;
        p.push({ t: 'block', m: m, x: x, y: y + h / 2 + GAP, w: w, h: h });
        return y + h + GAP;
      },
      plank: function (m, x, y, len, th) {
        th = th || 0.4;
        p.push({ t: 'block', m: m, x: x, y: y + th / 2 + GAP, w: len, h: th });
        return y + th + GAP;
      },
      box: function (m, x, y, s) {
        p.push({ t: 'block', m: m, x: x, y: y + s / 2 + GAP, w: s, h: s });
        return y + s + GAP;
      },
      round: function (m, x, y, r) {
        p.push({ t: 'round', m: m, x: x, y: y + r + GAP, r: r });
        return y + r * 2 + GAP;
      },
      tnt: function (x, y) {
        p.push({ t: 'tnt', x: x, y: y + 0.4 + GAP, w: 0.8, h: 0.8 });
        return y + 0.8 + GAP;
      },
      bandit: function (k, x, y) {
        p.push({ t: 'bandit', k: k, x: x, y: y + R(k) + GAP });
      },
      // Two columns under a plank spanning `span`. Returns the plank's top.
      frame: function (m, x, y, span, h, colW) {
        colW = colW || 0.4;
        b.col(m, x - span / 2 + colW / 2, y, h, colW);
        b.col(m, x + span / 2 - colW / 2, y, h, colW);
        return b.plank(m, x, y + h + GAP, span);
      }
    };
    return b;
  }

  function level(name, theme, birds, build) {
    var b = builder();
    build(b);
    return { name: name, theme: theme, birds: birds, pieces: b.pieces };
  }

  window.LEVELS = [
    level('First Flight', 0, ['rusty', 'rusty', 'rusty'], function (b) {
      var top = b.frame('wood', 22, 0, 3, 2);
      b.bandit('small', 22, 0);
      b.bandit('small', 22, top);
    }),

    level('Double Trouble', 0, ['rusty', 'rusty', 'rusty'], function (b) {
      var t1 = b.frame('wood', 20, 0, 3, 2);
      var t2 = b.frame('wood', 26, 0, 3, 2);
      b.bandit('small', 20, 0);
      b.bandit('small', 26, 0);
      b.col('wood', 20, t1, 1.2, 0.5);
      b.bandit('mid', 26, t2);
    }),

    level('Glass House', 0, ['rusty', 'zip', 'zip', 'rusty'], function (b) {
      var t1 = b.frame('ice', 24, 0, 3, 2);
      var t2 = b.frame('ice', 24, t1, 3, 2);
      b.bandit('small', 24, 0);
      b.bandit('small', 24, t1);
      b.bandit('small', 24, t2);
    }),

    level('Stone Steps', 0, ['rusty', 'zip', 'rusty', 'zip'], function (b) {
      b.frame('wood', 20, 0, 2.6, 1.6);
      b.bandit('small', 20, 0);
      var t1 = b.frame('stone', 24.5, 0, 3, 2.4);
      var t2 = b.frame('wood', 24.5, t1, 3, 1.6);
      b.bandit('helmet', 24.5, 0);
      b.bandit('small', 24.5, t1);
      b.bandit('small', 24.5, t2);
    }),

    level('Split Decision', 1, ['trio', 'trio', 'rusty'], function (b) {
      var t = 0;
      [20, 23.2, 26.4].forEach(function (x) {
        t = b.frame('wood', x, 0, 3, 1.6);
        b.bandit('small', x, 0);
      });
      b.bandit('mid', 23.2, t);
      b.box('ice', 20, t, 0.8);
      b.box('ice', 26.4, t, 0.8);
    }),

    level('Boom Town', 1, ['boomer', 'rusty', 'boomer'], function (b) {
      var t1 = b.frame('stone', 23, 0, 4, 2);
      b.tnt(21.9, 0);
      b.bandit('mid', 23.4, 0);
      var t2 = b.frame('wood', 23, t1, 3, 1.8);
      b.bandit('small', 23, t1);
      b.bandit('helmet', 23, t2);
    }),

    level('Tall Order', 1, ['zip', 'boomer', 'rusty', 'trio'], function (b) {
      b.frame('ice', 19.5, 0, 2, 1.4);
      b.bandit('small', 19.5, 0);
      var t1 = b.frame('wood', 24, 0, 2.4, 2);
      var t2 = b.frame('stone', 24, t1, 2.4, 2);
      var t3 = b.frame('wood', 24, t2, 2.4, 2);
      b.bandit('small', 24, 0);
      b.bandit('small', 24, t1);
      b.bandit('small', 24, t2);
      b.bandit('mid', 24, t3);
    }),

    level('Twin Peaks', 1, ['tank', 'rusty', 'zip', 'boomer', 'trio'], function (b) {
      [21, 28].forEach(function (x) {
        var t1 = b.frame('stone', x, 0, 2.6, 2);
        b.frame('wood', x, t1, 2.6, 2);
        b.bandit('small', x, 0);
        b.bandit('mid', x, t1);
      });
      b.frame('wood', 24.5, 0, 3, 2);
      b.bandit('big', 24.5, 0);
    }),

    level('Ice Palace', 2, ['trio', 'zip', 'boomer', 'rusty'], function (b) {
      var t1 = b.frame('stone', 22, 0, 3, 2);
      var t2 = b.frame('ice', 22, t1, 3, 2);
      var r1 = b.frame('ice', 26, 0, 3, 2);
      b.bandit('helmet', 22, 0);
      b.bandit('small', 22, t1);
      b.bandit('small', 22, t2);
      b.bandit('small', 26, 0);
      b.bandit('mid', 26, r1);
    }),

    level('Rolling Stones', 2, ['tank', 'boomer', 'zip'], function (b) {
      var t = b.frame('wood', 24, 0, 4, 2.2);
      b.bandit('big', 24, 0);
      b.col('wood', 22.2, t, 0.8, 0.3);
      b.col('wood', 25.8, t, 0.8, 0.3);
      b.round('stone', 22.9, t, 0.5);
      b.round('stone', 25.1, t, 0.5);
      b.bandit('small', 24, t);
      b.frame('ice', 29, 0, 2.4, 1.6);
      b.bandit('small', 29, 0);
    }),

    level('The Gauntlet', 2, ['rusty', 'zip', 'trio', 'boomer', 'tank', 'zip'], function (b) {
      var a = b.frame('wood', 19, 0, 2.4, 1.6);
      b.bandit('small', 19, 0);
      b.bandit('small', 19, a);
      var m1 = b.frame('stone', 24, 0, 3, 2);
      var m2 = b.frame('ice', 24, m1, 3, 2);
      b.bandit('helmet', 24, 0);
      b.bandit('mid', 24, m1);
      b.tnt(24, m2);
      var c1 = b.frame('wood', 30, 0, 3, 2.6);
      var c2 = b.frame('wood', 30, c1, 3, 2);
      b.bandit('big', 30, 0);
      b.bandit('small', 30, c1);
      b.bandit('small', 30, c2);
    }),

    level('Bandit King', 2, ['tank', 'boomer', 'zip', 'trio', 'boomer'], function (b) {
      b.frame('stone', 20, 0, 2, 2);
      b.bandit('small', 20, 0);
      b.frame('stone', 30, 0, 2, 2);
      b.bandit('small', 30, 0);
      var f1 = b.frame('stone', 25, 0, 5, 2.6);
      b.tnt(23.35, 0);
      b.tnt(26.65, 0);
      b.bandit('boss', 25, 0);
      var f2 = b.frame('wood', 25, f1, 4, 2);
      b.bandit('helmet', 24.2, f1);
      b.bandit('helmet', 25.8, f1);
      b.frame('ice', 25, f2, 2.6, 1.6);
      b.bandit('mid', 25, f2);
    })
  ];
})();
